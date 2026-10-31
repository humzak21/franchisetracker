/**
 * The nightly tidy (convex/crons.ts): finished screenshots past the retention setting go, with
 * their reads, a few sets a step. What they committed stays. Milestones stay too, acknowledged or
 * not, because they are a player's timeline; the feed reads an index that never sees old ones.
 */
import { v } from "convex/values";
import { counted, type JobOutcome } from "../../shared/ops/maintenance";
import { retentionCutoffs } from "../../shared/ops/retention";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { deleteSet, setUploads } from "../ingestion/sets";
import { finishRun } from "../lib/maintenanceRuns";

/** Sets one step deletes: each is a few storage deletes and a few rows. */
const SETS_PER_STEP = 25;
/** Uploads read per status, oldest first: a set is a few of them. */
const PAGE = 100;
const MAX_FRANCHISES = 50;

/** The oldest finished sets that have aged out, whole sets only: a set goes together or not at all. */
async function dueSets(ctx: QueryCtx, franchise: Doc<"franchises">, now: number): Promise<string[]> {
  const cutoffs = retentionCutoffs(franchise.settings.keepScreenshotsDays, now);
  if (!cutoffs) return [];
  const old = await Promise.all(
    (["committed", "rejected"] as const).map(async (status) => {
      const rows = await ctx.db
        .query("uploads")
        .withIndex("by_franchiseId_and_status", (q) =>
          q.eq("franchiseId", franchise._id).eq("status", status),
        )
        .take(PAGE);
      return rows.filter((u) => u.createdAt < cutoffs[status]);
    }),
  );
  const keys = [...new Set(old.flat().flatMap((u) => (u.setKey ? [u.setKey] : [])))];
  const due: string[] = [];
  for (const key of keys) {
    const set = await setUploads(ctx, franchise._id, key);
    const aged = set.every(
      (u) => (u.status === "committed" || u.status === "rejected") && u.createdAt < cutoffs[u.status],
    );
    if (aged) due.push(key);
  }
  return due;
}

export async function screenshotsDue(ctx: QueryCtx, franchise: Doc<"franchises">): Promise<JobOutcome> {
  const due = await dueSets(ctx, franchise, Date.now());
  const more = due.length >= PAGE ? "At least " : "";
  return {
    count: due.length,
    summary: `${more}${counted(due.length, "set")} of screenshots to delete`,
    lines: [],
  };
}

export const tidyFranchise = internalMutation({
  args: { franchiseId: v.id("franchises"), removed: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { franchiseId, removed = 0 }) => {
    const franchise = await ctx.db.get("franchises", franchiseId);
    if (!franchise || franchise.deletingAt !== undefined) return null;
    const due = await dueSets(ctx, franchise, Date.now());
    const step = due.slice(0, SETS_PER_STEP);
    for (const key of step) await deleteSet(ctx, franchiseId, key);
    const total = removed + step.length;
    if (due.length > step.length) {
      await ctx.scheduler.runAfter(0, internal.ops.retention.tidyFranchise, {
        franchiseId,
        removed: total,
      });
      return null;
    }
    await finishRun(ctx, franchiseId, "screenshots", `Deleted ${counted(total, "set")} of screenshots`);
    return null;
  },
});

/** Each franchise in its own scheduled step, so a failure reaches Settings → Errors by name. */
export const nightly = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const franchise of await ctx.db.query("franchises").take(MAX_FRANCHISES)) {
      if (franchise.deletingAt !== undefined) continue;
      await ctx.scheduler.runAfter(0, internal.ops.retention.tidyFranchise, { franchiseId: franchise._id });
      await ctx.scheduler.runAfter(0, internal.ingestion.budget.release, { franchiseId: franchise._id });
    }
    return null;
  },
});
