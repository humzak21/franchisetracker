/**
 * The extraction action (FEATURES.md 5.11): prompt and schema from the target registry, past
 * corrections as few-shot examples, the primary model then the fallback, then normalize,
 * resolve player names against the rosters, validate, and store a draft for review.
 */
import { v } from "convex/values";
import { chunkImages, mergeAnswers } from "../../shared/ingestion/chunks";
import { buildPrompt } from "../../shared/ingestion/prompt";
import type { Normalized } from "../../shared/ingestion/normalize";
import {
  isRowTarget,
  mergeFor,
  normalizeFor,
  schemaFor,
  validateDraft,
} from "../../shared/ingestion/targets";
import type { RowTargetDraft } from "../../shared/ingestion/types";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { blobToDataUrl, callVisionModel, openRouterKey, type VisionResult } from "../external/openrouter";
import { fixtureAnswer } from "./fixture";
import { FIXTURE_MODEL } from "./models";
import { resolvePlayers } from "./resolvePlayers";
import { RUN_BUDGET_MS } from "./sets";

type Job = NonNullable<Awaited<ReturnType<typeof loadJob>>> & {
  setKey: string;
  startedAt: number;
  deadline: number;
};

const loadJob = (ctx: ActionCtx, setKey: string) => ctx.runQuery(internal.ingestion.jobs.load, { setKey });

/** Thrown when the user stopped or restarted the set mid-run: nothing is written. */
class Superseded extends Error {}

/** No point starting a model call with less time than this left. */
const MIN_CALL_MS = 15_000;

export const run = internalAction({
  args: { setKey: v.string(), startedAt: v.number(), model: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { setKey, startedAt, model }) => {
    const loaded = await loadJob(ctx, setKey);
    if (!loaded) return null;
    const job = { ...loaded, setKey, startedAt, deadline: Date.now() + RUN_BUDGET_MS };
    try {
      const { normalized, last, usage, latencyMs } = await read(ctx, job, model);
      const draft = await resolvePlayers(ctx, job, normalized.draft, normalized.confidence);
      await ctx.runMutation(internal.ingestion.jobs.save, {
        setKey,
        startedAt,
        targetKey: job.targetKey,
        model: last.model,
        rawJson: last.rawText.slice(0, 200_000),
        draft,
        confidence: normalized.confidence,
        warnings: [...normalized.warnings, ...validateDraft(draft)],
        tokenUsage: usage,
        latencyMs,
      });
    } catch (error) {
      if (error instanceof Superseded) return null;
      const message = error instanceof Error ? error.message : "Extraction failed";
      await ctx.runMutation(internal.ingestion.jobs.fail, { setKey, startedAt, error: message });
    }
    return null;
  },
});

/** Requests at once when a set takes several (a list screenshot by screenshot, a big box score). */
const PARALLEL_READS = 4;

type Usage = VisionResult["usage"];
const addUsage = (a: Usage, b: Usage): Usage =>
  !a
    ? b
    : !b
      ? a
      : {
          prompt: a.prompt + b.prompt,
          completion: a.completion + b.completion,
          total: a.total + b.total,
          costUsd:
            a.costUsd === undefined && b.costUsd === undefined
              ? undefined
              : (a.costUsd ?? 0) + (b.costUsd ?? 0),
        };

/**
 * Reads the set. A game screen's shots go to the model together (one box score), a few per
 * request to stay under provider size caps, and the answers merge into one before normalizing;
 * a list's shots are read one at a time and merged, the union of their rows, so a list can run
 * to any length.
 */
async function read(ctx: ActionCtx, job: Job, model: string | undefined) {
  const { targetKey } = job;
  const rows = isRowTarget(targetKey);
  const requests = rows ? job.images.map((image) => [image]) : chunkImages(job.images);
  const results: VisionResult[] = [];
  for (let i = 0; i < requests.length; i += PARALLEL_READS) {
    const batch = requests.slice(i, i + PARALLEL_READS);
    results.push(...(await Promise.all(batch.map((images) => answer(ctx, job, images, model)))));
  }
  const normalized = rows
    ? mergeFor(
        targetKey,
        results.map((r) => normalizeFor(targetKey, r.json) as Normalized<RowTargetDraft>),
      )
    : normalizeFor(targetKey, mergeAnswers(results.map((r) => r.json)));
  return {
    normalized,
    last: results.at(-1)!,
    usage: results.reduce<Usage>((sum, r) => addUsage(sum, r.usage), undefined),
    latencyMs: results.reduce((n, r) => n + r.latencyMs, 0),
  };
}

async function answer(
  ctx: ActionCtx,
  job: Job,
  images: Job["images"],
  model: string | undefined,
): Promise<VisionResult> {
  const key = openRouterKey();
  if (!key) {
    if (!job.testMode)
      throw new Error("Set OPENROUTER_API_KEY on the Convex deployment to extract screenshots");
    const json = fixtureAnswer(job.targetKey, job.teams);
    return { json, rawText: JSON.stringify(json), model: FIXTURE_MODEL, usage: undefined, latencyMs: 0 };
  }
  const urls = await Promise.all(images.map((image) => imageUrl(ctx, image)));
  const { system, user } = buildPrompt(job.targetKey, job.context, job.corrections);
  const models = model ? [model] : [...new Set([job.models.primary, job.models.fallback])];
  const errors: string[] = [];
  for (const candidate of models) {
    // Checked before every call so a stopped set stops spending on the next screenshot or model.
    const current = await ctx.runQuery(internal.ingestion.jobs.isCurrent, {
      setKey: job.setKey,
      startedAt: job.startedAt,
    });
    if (!current) throw new Superseded();
    if (job.deadline - Date.now() < MIN_CALL_MS) {
      errors.push("Out of time: try fewer screenshots in the set, or a faster model");
      break;
    }
    const callStarted = Date.now();
    try {
      const result = await callVisionModel(key, {
        model: candidate,
        system,
        user,
        images: urls,
        schemaName: job.targetKey,
        schema: schemaFor(job.targetKey),
        temperature: job.models.temperature,
        maxTokens: job.models.maxTokens,
        deadline: job.deadline,
      });
      console.log(`${candidate}: ${images.length} screenshot(s) read in ${Date.now() - callStarted} ms`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `${candidate}: ${images.length} screenshot(s) failed after ${Date.now() - callStarted} ms`,
      );
      errors.push(message);
    }
  }
  throw new Error(errors.join(" · "));
}

/**
 * How the model gets a screenshot. On a cloud deployment it is the storage URL, which OpenRouter
 * fetches, so the action never holds the images: a set of full-size phone screenshots as base64
 * ran it out of memory, and Convex stops such an action without running its error handling. A
 * local backend's URLs are not reachable from OpenRouter, so it sends `data:` URLs instead.
 */
async function imageUrl(ctx: ActionCtx, image: Job["images"][number]): Promise<string> {
  const url = await ctx.storage.getUrl(image.storageId);
  if (url?.startsWith("https://")) return url;
  const blob = await ctx.storage.get(image.storageId);
  if (!blob) throw new Error("A screenshot in this set is missing from storage");
  return await blobToDataUrl(blob, image.mime);
}
