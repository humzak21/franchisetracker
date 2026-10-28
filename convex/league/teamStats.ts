/**
 * The user team's season team stats (team rank ribbons): per stat, the value captured from the
 * team stats screen (or its manual entry), else the one derived from the season's games
 * (`seasons.teamTotals`), with the league rank wherever one was captured.
 */
import { v } from "convex/values";
import { TEAM_SEASON_STAT_KEYS } from "../../shared/stats/teamSeasonRegistry";
import { rankTrends, seasonRows } from "../../shared/stats/teamTrends";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise } from "../lib/franchise";
import { franchiseSeasonList } from "../lib/reports";
import { literals } from "../lib/validators";

/** Every registry stat for a century of seasons. */
const MAX_ROWS = 2000;

const vStatKey = literals(TEAM_SEASON_STAT_KEYS);
const vSource = v.union(v.literal("games"), v.literal("captured"));

export const trends = query({
  args: {},
  returns: v.array(
    v.object({
      statKey: vStatKey,
      points: v.array(
        v.object({
          year: v.number(),
          value: v.number(),
          rank: v.union(v.number(), v.null()),
          tied: v.boolean(),
          source: vSource,
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [rows, seasons] = await Promise.all([
      ctx.db
        .query("teamSeasonStats")
        .withIndex("by_franchiseId_and_teamId_and_statKey", (q) =>
          q.eq("franchiseId", franchise._id).eq("teamId", franchise.userTeamId),
        )
        .take(MAX_ROWS),
      franchiseSeasonList(ctx, franchise._id),
    ]);
    const yearOf = new Map(seasons.map((s) => [s._id, s.year]));
    return rankTrends(
      seasonRows(
        rows.flatMap((row) => {
          const year = yearOf.get(row.seasonId);
          return year === undefined ? [] : [{ ...row, year }];
        }),
        seasons.flatMap((s) => (s.teamTotals ? [{ year: s.year, stats: s.teamTotals.stats }] : [])),
      ),
    );
  },
});
