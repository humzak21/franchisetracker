/**
 * Error reporting (FEATURES.md 8): the browser sends what broke, and a sweep picks up scheduled
 * jobs that failed, one row per distinct error with a count, so Settings can show what went wrong
 * without a third-party service or the Convex dashboard.
 */
import { v } from "convex/values";
import { errorFingerprint } from "../../shared/ops/errors";
import { internalMutation, mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import schema from "../schema";

/** Distinct errors kept; older ones are pruned as new ones arrive. */
const MAX_REPORTS = 100;
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;
/** Scheduled runs looked at per sweep: far more than a quarter of an hour ever starts. */
const MAX_SCHEDULED = 1000;

const vKind = v.union(v.literal("render"), v.literal("error"), v.literal("rejection"));

/** Drops the oldest past the cap. */
async function pruneReports(ctx: MutationCtx) {
  const overflow = await ctx.db
    .query("errorReports")
    .withIndex("by_lastSeen")
    .order("desc")
    .take(MAX_REPORTS + 10);
  for (const old of overflow.slice(MAX_REPORTS)) await ctx.db.delete("errorReports", old._id);
}

export const report = mutation({
  args: {
    kind: vKind,
    message: v.string(),
    stack: v.optional(v.string()),
    path: v.string(),
    userAgent: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const message = args.message.slice(0, MAX_MESSAGE) || "Unknown error";
    const stack = args.stack?.slice(0, MAX_STACK);
    const fingerprint = errorFingerprint(message, stack);
    const now = Date.now();
    const existing = await ctx.db
      .query("errorReports")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
      .unique();
    if (existing) {
      await ctx.db.patch("errorReports", existing._id, {
        count: existing.count + 1,
        lastSeen: now,
        path: args.path.slice(0, 200),
      });
      return null;
    }
    await ctx.db.insert("errorReports", {
      fingerprint,
      kind: args.kind,
      message,
      stack,
      path: args.path.slice(0, 200),
      userAgent: args.userAgent?.slice(0, 300),
      count: 1,
      firstSeen: now,
      lastSeen: now,
    });
    await pruneReports(ctx);
    return null;
  },
});

/**
 * Files scheduled jobs that failed under their function's name. A failure is counted once however
 * many sweeps see it: only one newer than the report's `lastSeen` adds to it.
 */
export const sweepScheduled = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const runs = await ctx.db.system.query("_scheduled_functions").order("desc").take(MAX_SCHEDULED);
    const failed = runs
      .flatMap((run) => (run.state.kind === "failed" ? [{ run, error: run.state.error }] : []))
      .sort((a, b) => (a.run.completedTime ?? 0) - (b.run.completedTime ?? 0));
    let filed = 0;
    for (const { run, error } of failed) {
      const at = run.completedTime ?? run.scheduledTime;
      const message = (error || "A scheduled job failed").slice(0, MAX_MESSAGE);
      const fingerprint = errorFingerprint(message, run.name);
      const existing = await ctx.db
        .query("errorReports")
        .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
        .unique();
      if (existing && at <= existing.lastSeen) continue;
      filed++;
      if (existing) {
        await ctx.db.patch("errorReports", existing._id, { count: existing.count + 1, lastSeen: at });
        continue;
      }
      const fields = { message, path: run.name, count: 1, firstSeen: at, lastSeen: at };
      await ctx.db.insert("errorReports", { fingerprint, kind: "scheduled", ...fields });
    }
    if (filed > 0) await pruneReports(ctx);
    return filed;
  },
});

/** Says the owner knows about these; one that happens again shows as new. */
export const markSeen = mutation({
  args: { ids: v.array(v.id("errorReports")) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    await requireOwner(ctx);
    const seenAt = Date.now();
    for (const id of ids.slice(0, MAX_REPORTS)) await ctx.db.patch("errorReports", id, { seenAt });
    return null;
  },
});

/** The latest distinct errors, newest first. */
export const recent = query({
  args: {},
  returns: v.array(schema.doc("errorReports")),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db.query("errorReports").withIndex("by_lastSeen").order("desc").take(MAX_REPORTS);
  },
});

export const clear = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const reports = await ctx.db
      .query("errorReports")
      .withIndex("by_lastSeen")
      .take(MAX_REPORTS + 10);
    for (const r of reports) await ctx.db.delete("errorReports", r._id);
    return null;
  },
});
