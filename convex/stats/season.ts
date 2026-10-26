import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById } from "../lib/franchise";
import { vPosition, vPositionGroup, vStatMap, vStatSplit } from "../lib/validators";

const MAX_ROWS = 300;

const vRow = v.object({
  playerId: v.id("players"),
  name: v.string(),
  position: vPosition,
  positionGroup: v.union(vPositionGroup, v.null()),
  jersey: v.union(v.number(), v.null()),
  source: v.union(v.literal("logs"), v.literal("import")),
  gamesPlayed: v.number(),
  totals: vStatMap,
  thresholdCounts: vStatMap,
  bests: vStatMap,
});

/**
 * The user team's season stats for one split, one row per player. Totals derived from game logs
 * win over imported totals for the same player and season (FEATURES.md principle 1).
 */
export const bySplit = query({
  args: { seasonId: v.id("seasons"), split: vStatSplit },
  returns: v.array(vRow),
  handler: async (ctx, { seasonId, split }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const rows = await ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_seasonId_and_teamId", (q) =>
        q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
      )
      .take(MAX_ROWS);
    const byPlayer = new Map<Id<"players">, Doc<"seasonPlayerStats">>();
    for (const row of rows) {
      if (row.split !== split) continue;
      const existing = byPlayer.get(row.playerId);
      if (!existing || (existing.source === "import" && row.source === "logs"))
        byPlayer.set(row.playerId, row);
    }
    const players = await playersById(ctx, byPlayer.keys());
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) =>
        q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
      )
      .take(MAX_ROWS);
    const jerseys = new Map(entries.map((e) => [e.playerId, e.jersey ?? null]));
    return [...byPlayer.values()].flatMap((row) => {
      const player = players.get(row.playerId);
      if (!player) return [];
      return [
        {
          playerId: row.playerId,
          name: player.displayName,
          position: row.position ?? player.position,
          positionGroup: row.positionGroup ?? null,
          jersey: jerseys.get(row.playerId) ?? null,
          source: row.source,
          gamesPlayed: row.gamesPlayed,
          totals: row.totals,
          thresholdCounts: row.thresholdCounts ?? {},
          bests: row.bests ?? {},
        },
      ];
    });
  },
});
