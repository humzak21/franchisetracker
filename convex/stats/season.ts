import { v } from "convex/values";
import { withMissingGames } from "../../shared/ingestion/reconcile";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { vPosition, vPositionGroup, vStatMap, vStatSplit } from "../lib/validators";
import { vSeasonHighs } from "../schema/stats";

const MAX_ROWS = 300;

const vRow = v.object({
  playerId: v.id("players"),
  name: v.string(),
  headshotUrl: v.union(v.string(), v.null()),
  position: vPosition,
  positionGroup: v.union(vPositionGroup, v.null()),
  jersey: v.union(v.number(), v.null()),
  source: v.union(v.literal("logs"), v.literal("import")),
  gamesPlayed: v.number(),
  totals: vStatMap,
  thresholdCounts: vStatMap,
  bestGames: vSeasonHighs,
  /** Stats showing the season screen's number because a game's box score is missing. */
  overridden: v.array(v.string()),
});

/**
 * The user team's season stats for one split, one row per player. Totals derived from game logs
 * win over imported totals for the same player and season (FEATURES.md principle 1); in the
 * regular season, a stat settled as "a game is missing" on the reconcile screen shows the
 * season screen's number instead.
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
    const photos = await headshotUrls(ctx, players.values());
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) =>
        q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
      )
      .take(MAX_ROWS);
    const jerseys = new Map(entries.map((e) => [e.playerId, e.jersey ?? null]));
    const reported =
      split === "regular"
        ? await ctx.db
            .query("reportedSeasonStats")
            .withIndex("by_seasonId_and_teamId", (q) =>
              q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
            )
            .take(MAX_ROWS)
        : [];
    const reportedFor = new Map(reported.map((r) => [r.playerId, r]));
    return [...byPlayer.values()].flatMap((row) => {
      const player = players.get(row.playerId);
      if (!player) return [];
      const shown =
        row.source === "logs"
          ? withMissingGames(row, reportedFor.get(row.playerId))
          : { gamesPlayed: row.gamesPlayed, totals: row.totals, overridden: [] };
      return [
        {
          playerId: row.playerId,
          name: player.displayName,
          headshotUrl: photos.get(player._id) ?? null,
          position: row.position ?? player.position,
          positionGroup: row.positionGroup ?? null,
          jersey: jerseys.get(row.playerId) ?? null,
          source: row.source,
          gamesPlayed: shown.gamesPlayed,
          totals: shown.totals,
          overridden: shown.overridden,
          thresholdCounts: row.thresholdCounts ?? {},
          bestGames: row.bestGames ?? {},
        },
      ];
    });
  },
});
