/**
 * Error reporting (FEATURES.md 8): the browser sends what broke, one row per distinct error with
 * a count, so Settings can show what went wrong on which device without a third-party service.
 */
import { v } from "convex/values";
import { errorFingerprint } from "../../shared/ops/errors";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import schema from "../schema";

/** Distinct errors kept; older ones are pruned as new ones arrive. */
const MAX_REPORTS = 100;
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

const vKind = v.union(v.literal("render"), v.literal("error"), v.literal("rejection"));

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
    const overflow = await ctx.db
      .query("errorReports")
      .withIndex("by_lastSeen")
      .order("desc")
      .take(MAX_REPORTS + 10);
    for (const old of overflow.slice(MAX_REPORTS)) await ctx.db.delete("errorReports", old._id);
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
