/** Data access for the extraction action, which has no `ctx.db` of its own. */
import { v } from "convex/values";
import { INGESTION_TARGETS, isTargetKey } from "../../shared/ingestion/targets";
import { weekLabel } from "../../shared/domain";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { vDraft, vDraftWarning, vFieldConfidence, vTargetKey } from "../lib/draftValidators";
import { activeFranchise, teamsById } from "../lib/franchise";
import { testModeEnabled } from "../lib/owner";
import { vScalar } from "../lib/validators";
import { MAX_FEW_SHOT } from "../../shared/ingestion/prompt";
import { modelSettings } from "./models";
import { isCurrentRun, setUploads } from "./sets";

/** Everything one extraction needs: images, target, prompt context, models and past corrections. */
export const load = internalQuery({
  args: { setKey: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      targetKey: vTargetKey,
      seasonId: v.union(v.id("seasons"), v.null()),
      images: v.array(v.object({ storageId: v.id("_storage"), mime: v.string() })),
      context: v.object({
        when: v.optional(v.string()),
        userTeam: v.string(),
        opponent: v.optional(v.string()),
      }),
      teams: v.object({ home: v.string(), away: v.string(), userIsHome: v.boolean() }),
      models: v.object({
        primary: v.string(),
        fallback: v.string(),
        temperature: v.number(),
        maxTokens: v.number(),
      }),
      corrections: v.array(v.object({ fieldPath: v.string(), extracted: vScalar, corrected: vScalar })),
      testMode: v.boolean(),
    }),
  ),
  handler: async (ctx, { setKey }) => {
    const franchise = await activeFranchise(ctx);
    const set = await setUploads(ctx, franchise._id, setKey);
    const lead = set[0];
    if (!lead?.targetKey || !isTargetKey(lead.targetKey)) return null;

    const teams = await teamsById(ctx);
    const userTeam = teams.get(franchise.userTeamId);
    if (!userTeam) return null;
    const game = lead.gameId
      ? await ctx.db.get("games", lead.gameId)
      : lead.seasonId && lead.weekKey
        ? await ctx.db
            .query("games")
            .withIndex("by_seasonId_and_weekKey", (q) =>
              q.eq("seasonId", lead.seasonId!).eq("weekKey", lead.weekKey!),
            )
            .first()
        : null;
    const opponent = game?.opponentTeamId ? teams.get(game.opponentTeamId) : undefined;
    const season = lead.seasonId ? await ctx.db.get("seasons", lead.seasonId) : null;
    // A season screen (standings, leaders) is not about any one week.
    const weekKey =
      INGESTION_TARGETS[lead.targetKey].scope === "season" ? undefined : (game?.weekKey ?? lead.weekKey);
    const userIsHome = game?.userIsHome ?? true;

    const corrections = await ctx.db
      .query("corrections")
      .withIndex("by_franchiseId_and_targetKey_and_usedAsExample", (q) =>
        q.eq("franchiseId", franchise._id).eq("targetKey", lead.targetKey!).eq("usedAsExample", true),
      )
      .order("desc")
      .take(MAX_FEW_SHOT);

    return {
      targetKey: lead.targetKey,
      seasonId: lead.seasonId ?? null,
      images: set.map((u) => ({ storageId: u.storageId, mime: u.mime })),
      context: {
        when: season ? `${season.year} season${weekKey ? `, ${weekLabel(weekKey, "long")}` : ""}` : undefined,
        userTeam: `${userTeam.abbr} (${userTeam.city} ${userTeam.name})`,
        opponent: opponent ? `${opponent.abbr} (${opponent.city} ${opponent.name})` : undefined,
      },
      teams: {
        home: userIsHome ? userTeam.abbr : (opponent?.abbr ?? "MIA"),
        away: userIsHome ? (opponent?.abbr ?? "MIA") : userTeam.abbr,
        userIsHome,
      },
      models: modelSettings(franchise),
      corrections: corrections.map((c) => ({
        fieldPath: c.fieldPath,
        extracted: c.extractedValue,
        corrected: c.correctedValue,
      })),
      testMode: testModeEnabled(),
    };
  },
});

/** Whether a run is still the one its set is waiting on (not stopped or restarted since). */
export const isCurrent = internalQuery({
  args: { setKey: v.string(), startedAt: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { setKey, startedAt }) => {
    const franchise = await activeFranchise(ctx);
    const set = await setUploads(ctx, franchise._id, setKey);
    return set.some((u) => isCurrentRun(u, startedAt));
  },
});

export const save = internalMutation({
  args: {
    setKey: v.string(),
    startedAt: v.number(),
    targetKey: vTargetKey,
    model: v.string(),
    rawJson: v.string(),
    draft: vDraft,
    confidence: v.array(vFieldConfidence),
    warnings: v.array(vDraftWarning),
    tokenUsage: v.optional(
      v.object({
        prompt: v.number(),
        completion: v.number(),
        total: v.number(),
        costUsd: v.optional(v.number()),
      }),
    ),
    latencyMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { setKey, startedAt, ...extraction }) =>
    await finish(ctx, setKey, startedAt, async (lead) => {
      const previous = await ctx.db
        .query("extractions")
        .withIndex("by_setKey", (q) => q.eq("setKey", setKey))
        .take(50);
      for (const old of previous) await ctx.db.delete("extractions", old._id);
      await ctx.db.insert("extractions", {
        franchiseId: lead.franchiseId,
        uploadId: lead._id,
        setKey,
        ...extraction,
      });
      return { status: "review" as const };
    }),
});

export const fail = internalMutation({
  args: { setKey: v.string(), startedAt: v.number(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { setKey, startedAt, error }) =>
    await finish(ctx, setKey, startedAt, async () => ({
      status: "failed" as const,
      error: error.slice(0, 500),
    })),
});

/** How often the watchdog looks again at a run still waiting in the scheduler or running. */
const WATCHDOG_RECHECK_MS = 60_000;

/**
 * Watchdog: a run that is over but never reported back (Convex stops an action at 10 minutes
 * without running its error handling) leaves its set extracting; this fails the set instead.
 */
export const expire = internalMutation({
  args: { setKey: v.string(), startedAt: v.number(), runId: v.id("_scheduled_functions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.system.get("_scheduled_functions", args.runId);
    if (run?.state.kind === "pending" || run?.state.kind === "inProgress") {
      await ctx.scheduler.runAfter(WATCHDOG_RECHECK_MS, internal.ingestion.jobs.expire, args);
      return null;
    }
    return await finish(ctx, args.setKey, args.startedAt, async () => ({
      status: "failed" as const,
      error: "Timed out: the model never answered. Try again, or pick a faster model.",
    }));
  },
});

/** Applies the outcome to the set's uploads in this run; a deleted, stopped or restarted set is ignored. */
async function finish(
  ctx: MutationCtx,
  setKey: string,
  startedAt: number,
  outcome: (lead: Doc<"uploads">) => Promise<{ status: "review" | "failed"; error?: string }>,
): Promise<null> {
  const franchise = await activeFranchise(ctx);
  const set = await setUploads(ctx, franchise._id, setKey);
  const lead = set[0];
  if (!lead || !set.some((u) => isCurrentRun(u, startedAt))) return null;
  const patch = { ...(await outcome(lead)), extractionStartedAt: undefined };
  for (const upload of set)
    if (isCurrentRun(upload, startedAt)) await ctx.db.patch("uploads", upload._id, patch);
  return null;
}
