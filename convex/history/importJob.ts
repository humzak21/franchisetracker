/**
 * The import job: a chain of scheduled action steps (`nflverseImport.runStep`), each fetching
 * one slice of nflverse and writing it through the import mutations. The job row records the
 * plan and progress for Settings; every step checks `run` so a restart supersedes old steps.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { must } from "../lib/errors";

/** A running job older than this is assumed dead (its action timed out) and may be restarted. */
export const STALE_IMPORT_MS = 30 * 60_000;

const vCounts = v.object({
  seasons: v.optional(v.number()),
  players: v.optional(v.number()),
  statRows: v.optional(v.number()),
  draftPicks: v.optional(v.number()),
  rosterEntries: v.optional(v.number()),
});
type Counts = Doc<"historyImports">["counts"];
const ZERO: Counts = { seasons: 0, players: 0, statRows: 0, draftPicks: 0, rosterEntries: 0 };

export async function importFor(ctx: QueryCtx, franchiseId: Id<"franchises">) {
  return await ctx.db
    .query("historyImports")
    .withIndex("by_franchiseId", (q) => q.eq("franchiseId", franchiseId))
    .first();
}

/** Starts (or restarts) the import. False when a live run is already going. */
export async function startImport(ctx: MutationCtx, franchiseId: Id<"franchises">): Promise<boolean> {
  const job = await importFor(ctx, franchiseId);
  const now = Date.now();
  if (job?.status === "running" && now - job.startedAt < STALE_IMPORT_MS) return false;
  const run = (job?.run ?? 0) + 1;
  const fields = {
    franchiseId,
    run,
    status: "running" as const,
    plan: ["seasons"],
    stepsDone: 0,
    counts: ZERO,
    startedAt: now,
  };
  if (job) await ctx.db.replace("historyImports", job._id, fields);
  else await ctx.db.insert("historyImports", fields);
  await ctx.scheduler.runAfter(0, internal.history.nflverseImport.runStep, {
    franchiseId,
    run,
    step: "seasons",
  });
  return true;
}

/** What a step needs to know about the franchise and the run it belongs to. */
export const context = internalQuery({
  args: { franchiseId: v.id("franchises") },
  returns: v.union(
    v.null(),
    v.object({
      run: v.number(),
      running: v.boolean(),
      startYear: v.number(),
      userTeamId: v.id("teams"),
      firstYear: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, { franchiseId }) => {
    const franchise = await ctx.db.get("franchises", franchiseId);
    const job = await importFor(ctx, franchiseId);
    if (!franchise || !job) return null;
    return {
      run: job.run,
      running: job.status === "running",
      startYear: franchise.startYear,
      userTeamId: franchise.userTeamId,
      firstYear: job.firstYear ?? null,
    };
  },
});

function add(counts: Counts, more: (typeof vCounts)["type"]): Counts {
  return {
    seasons: counts.seasons + (more.seasons ?? 0),
    players: counts.players + (more.players ?? 0),
    statRows: counts.statRows + (more.statRows ?? 0),
    draftPicks: counts.draftPicks + (more.draftPicks ?? 0),
    rosterEntries: counts.rosterEntries + (more.rosterEntries ?? 0),
  };
}

/**
 * Records a finished step and schedules the next. A step that has more to do passes
 * `continueCursor` and runs again from there without counting as done.
 */
export const advance = internalMutation({
  args: {
    franchiseId: v.id("franchises"),
    run: v.number(),
    counts: vCounts,
    plan: v.optional(v.array(v.string())),
    firstYear: v.optional(v.number()),
    lastYear: v.optional(v.number()),
    continueCursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { franchiseId, run, counts, plan, firstYear, lastYear, continueCursor }) => {
    const job = must(await importFor(ctx, franchiseId), "Import");
    if (job.run !== run || job.status !== "running") return null;
    const nextPlan = plan ?? job.plan;
    const stepsDone = continueCursor === undefined ? job.stepsDone + 1 : job.stepsDone;
    const done = stepsDone >= nextPlan.length;
    await ctx.db.patch("historyImports", job._id, {
      plan: nextPlan,
      stepsDone,
      counts: add(job.counts, counts),
      firstYear: firstYear ?? job.firstYear,
      lastYear: lastYear ?? job.lastYear,
      ...(done ? { status: "done" as const, finishedAt: Date.now() } : {}),
    });
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.history.nflverseImport.runStep, {
        franchiseId,
        run,
        step: nextPlan[stepsDone]!,
        cursor: continueCursor,
      });
    }
    return null;
  },
});

export const fail = internalMutation({
  args: { franchiseId: v.id("franchises"), run: v.number(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { franchiseId, run, error }) => {
    const job = await importFor(ctx, franchiseId);
    if (!job || job.run !== run) return null;
    await ctx.db.patch("historyImports", job._id, {
      status: "failed",
      error: error.slice(0, 500),
      finishedAt: Date.now(),
    });
    return null;
  },
});
