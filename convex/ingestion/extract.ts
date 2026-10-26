/**
 * The extraction action (FEATURES.md 5.11): prompt and schema from the target registry, past
 * corrections as few-shot examples, the primary model then the fallback, then normalize,
 * resolve player names against the rosters, validate, and store a draft for review.
 */
import { v } from "convex/values";
import { matchPlayer } from "../../shared/ingestion/nameMatch";
import { buildPrompt } from "../../shared/ingestion/prompt";
import { INGESTION_TARGETS, validateDraft } from "../../shared/ingestion/targets";
import type { Draft, FieldConfidence } from "../../shared/ingestion/types";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import { blobToDataUrl, callVisionModel, openRouterKey, type VisionResult } from "../external/openrouter";
import type { StoredDraft } from "../lib/draftValidators";
import { fixtureAnswer } from "./fixture";
import { FIXTURE_MODEL } from "./models";

type Job = NonNullable<Awaited<ReturnType<typeof loadJob>>>;

const loadJob = (ctx: ActionCtx, setKey: string) => ctx.runQuery(internal.ingestion.jobs.load, { setKey });

export const run = internalAction({
  args: { setKey: v.string(), model: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { setKey, model }) => {
    const job = await loadJob(ctx, setKey);
    if (!job) return null;
    try {
      const result = await answer(ctx, job, model);
      const target = INGESTION_TARGETS[job.targetKey];
      const normalized = target.normalize(result.json);
      const draft = await resolvePlayers(ctx, job, normalized.draft, normalized.confidence);
      await ctx.runMutation(internal.ingestion.jobs.save, {
        setKey,
        targetKey: job.targetKey,
        model: result.model,
        rawJson: result.rawText.slice(0, 200_000),
        draft,
        confidence: normalized.confidence,
        warnings: [...normalized.warnings, ...validateDraft(draft)],
        tokenUsage: result.usage,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed";
      await ctx.runMutation(internal.ingestion.jobs.fail, { setKey, error: message });
    }
    return null;
  },
});

async function answer(ctx: ActionCtx, job: Job, model: string | undefined): Promise<VisionResult> {
  const key = openRouterKey();
  if (!key) {
    if (!job.testMode)
      throw new Error("Set OPENROUTER_API_KEY on the Convex deployment to extract screenshots");
    const json = fixtureAnswer(job.targetKey, job.teams);
    return { json, rawText: JSON.stringify(json), model: FIXTURE_MODEL, usage: undefined, latencyMs: 0 };
  }
  const images = await Promise.all(
    job.images.map(async (image) => {
      const blob = await ctx.storage.get(image.storageId);
      if (!blob) throw new Error("A screenshot in this set is missing from storage");
      return await blobToDataUrl(blob, image.mime);
    }),
  );
  const { system, user } = buildPrompt(job.targetKey, job.context, job.corrections);
  const models = model ? [model] : [...new Set([job.models.primary, job.models.fallback])];
  const errors: string[] = [];
  for (const candidate of models) {
    try {
      return await callVisionModel(key, {
        model: candidate,
        system,
        user,
        images,
        schemaName: job.targetKey,
        schema: INGESTION_TARGETS[job.targetKey].schema(),
        temperature: job.models.temperature,
        maxTokens: job.models.maxTokens,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join(" · "));
}

/** Low confidence on a name the rosters could not settle, so review shows it first. */
const UNSETTLED_NAME = 0.4;

async function resolvePlayers(
  ctx: ActionCtx,
  job: Job,
  draft: Draft,
  confidence: FieldConfidence[],
): Promise<StoredDraft> {
  if (draft.target !== "game_box_score") return draft;
  const teamAbbrs = [draft.game.homeAbbr, draft.game.awayAbbr, ...draft.lines.map((l) => l.teamAbbr)].filter(
    (t): t is string => t !== null,
  );
  const candidates = await ctx.runQuery(internal.ingestion.jobs.candidates, {
    seasonId: job.seasonId,
    teamAbbrs: [...new Set(teamAbbrs)],
    names: draft.lines.map((l) => l.name),
  });
  return {
    ...draft,
    lines: draft.lines.map((line) => {
      const match = matchPlayer<Id<"players">>(line.name, candidates, line);
      if (match.status === "ambiguous") {
        const path = `lines.${line.id}.name`;
        const entry = confidence.find((c) => c.path === path);
        if (entry) entry.value = Math.min(entry.value, UNSETTLED_NAME);
      }
      return {
        ...line,
        match,
        playerId: match.status === "matched" ? (match.candidates[0]?.playerId ?? null) : null,
      };
    }),
  };
}
