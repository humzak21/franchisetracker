/**
 * Rebuilds everything derived from the game logs: every season and career row, then the records
 * books and the rest of what `stats/recordBuild` keeps, one job per franchise. Run it after a
 * change to what those rows materialize, from Settings → Data or with
 * `npx convex run stats/rebuild:all`. Idempotent: each step replaces what it writes from scratch,
 * so running it twice, or over a half-finished run, is safe.
 */
import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise } from "../lib/franchise";
import { startRecordBuild } from "./recordBuild";

const MAX_FRANCHISES = 50;

/** Every franchise, each in its own job. Returns how many were started. */
export const all = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const franchises = await ctx.db.query("franchises").take(MAX_FRANCHISES);
    for (const franchise of franchises) await startRecordBuild(ctx, franchise._id, "logs");
    return franchises.length;
  },
});

/** The active franchise, from Settings → Data. */
export const start = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    await startRecordBuild(ctx, (await activeFranchise(ctx))._id, "logs");
    return null;
  },
});
