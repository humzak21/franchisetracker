/**
 * CSV exports (FEATURES.md 5.12): the user team's player seasons across the franchise's own
 * seasons, flat for a spreadsheet. Games come from `games/directory.all`; everything else is in
 * the JSON backup.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById } from "../lib/franchise";
import { franchiseSeasonList } from "../lib/reports";
import { vPosition, vStatMap, vStatSplit } from "../lib/validators";

/** A season's player rows for one team, both splits: a full roster with room to spare. */
const MAX_ROWS_PER_SEASON = 300;

export const playerSeasons = query({
  args: {},
  returns: v.array(
    v.object({
      year: v.number(),
      split: vStatSplit,
      player: v.string(),
      position: v.union(vPosition, v.null()),
      gamesPlayed: v.number(),
      totals: vStatMap,
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const seasons = (await franchiseSeasonList(ctx, franchise._id)).filter(
      (s) => s.year >= franchise.startYear,
    );
    const perSeason = await Promise.all(
      seasons.map(async (season) => ({
        year: season.year,
        rows: await ctx.db
          .query("seasonPlayerStats")
          .withIndex("by_seasonId_and_teamId", (q) =>
            q.eq("seasonId", season._id).eq("teamId", franchise.userTeamId),
          )
          .take(MAX_ROWS_PER_SEASON),
      })),
    );
    const players = await playersById(
      ctx,
      perSeason.flatMap((s) => s.rows.map((r) => r.playerId)),
    );
    return perSeason.flatMap(({ year, rows }) =>
      rows.map((r) => {
        const player = players.get(r.playerId);
        return {
          year,
          split: r.split,
          player: player?.displayName ?? "Unknown",
          position: r.position ?? player?.position ?? null,
          gamesPlayed: r.gamesPlayed,
          totals: r.totals,
        };
      }),
    );
  },
});
