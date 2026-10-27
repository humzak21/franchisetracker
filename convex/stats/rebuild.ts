/**
 * Rebuilds every log-derived season row and career row from the game logs, a page of players
 * at a time in the background. Run it after a change to what those rows materialize (a new
 * threshold game, season highs): `npx convex run stats/rebuild:all`. Idempotent: each step
 * replaces a player's rows from scratch, so running it twice, or over a half-finished run, is safe.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { recomputeCareer, recomputePlayerSeason } from "./recompute";

/** Players per step; a long career reads a few hundred lines, so this stays well inside the limits. */
const PAGE = 20;
const MAX_FRANCHISES = 50;
/** Twenty seasons of a long career, playoffs included. */
const MAX_PLAYER_LINES = 600;
const MAX_SEASON_ROWS = 120;

/** Every franchise, each rebuilt in its own chain of steps. Returns how many were started. */
export const all = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const franchises = await ctx.db.query("franchises").take(MAX_FRANCHISES);
    for (const franchise of franchises) {
      await ctx.scheduler.runAfter(0, internal.stats.rebuild.franchise, {
        franchiseId: franchise._id,
        cursor: null,
      });
    }
    return franchises.length;
  },
});

/** One page of a franchise's players, then the next page. */
export const franchise = internalMutation({
  args: { franchiseId: v.id("franchises"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { franchiseId, cursor }) => {
    const page = await ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_lastName", (q) => q.eq("franchiseId", franchiseId))
      .paginate({ numItems: PAGE, cursor });
    for (const player of page.page) await rebuildPlayer(ctx, player);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.stats.rebuild.franchise, {
        franchiseId,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

async function rebuildPlayer(ctx: MutationCtx, player: Doc<"players">) {
  const lines = await ctx.db
    .query("gameStatLines")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id))
    .take(MAX_PLAYER_LINES);
  const rows = await ctx.db
    .query("seasonPlayerStats")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id))
    .take(MAX_SEASON_ROWS);
  // Seasons with logs, plus any log-derived row whose lines are gone, so a stale row is dropped.
  const seasonIds = new Set([
    ...lines.map((l) => l.seasonId),
    ...rows.filter((r) => r.source === "logs").map((r) => r.seasonId),
  ]);
  // Imported history alone has nothing log-derived to rebuild.
  if (seasonIds.size === 0) return;
  for (const seasonId of seasonIds) await recomputePlayerSeason(ctx, player, seasonId);
  await recomputeCareer(ctx, player);
}
