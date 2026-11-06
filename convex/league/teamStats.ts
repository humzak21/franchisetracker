/**
 * Team season stats. `trends` is the user team's season cards: per stat, the value captured from
 * the team stats screen (or typed in), else the league team stats screen's, else the one derived
 * from the season's games (`seasons.teamTotals`), with its league rank (captured, else worked
 * out from League → Teams) and the league average. `leagueBySeason` is every team's numbers from the league team stats
 * screen, the user team's filled in from its games.
 */
import { v } from "convex/values";
import { teamSeasonStatsFromLeague, withLeagueStanding } from "../../shared/stats/teamSeasonLeague";
import { TEAM_SEASON_STAT_KEYS } from "../../shared/stats/teamSeasonRegistry";
import { rankTrends, seasonRows } from "../../shared/stats/teamTrends";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { seasonLeagueLines, type SeasonLeague } from "../lib/leagueLines";
import { franchiseSeasonList } from "../lib/reports";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { literals, vStatMap } from "../lib/validators";

/** Every registry stat for a century of seasons. */
const MAX_ROWS = 2000;

const vStatKey = literals(TEAM_SEASON_STAT_KEYS);
const vSource = v.union(v.literal("games"), v.literal("league"), v.literal("captured"));

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
          /** Teams ranked that season, when League → Teams has them. */
          of: v.union(v.number(), v.null()),
          average: v.union(v.number(), v.null()),
          rankFromLeague: v.boolean(),
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
    const captured = rows.flatMap((row) => {
      const year = yearOf.get(row.seasonId);
      return year === undefined ? [] : [{ ...row, year }];
    });
    const capturedYears = new Set(captured.map((row) => row.year));
    // League → Teams belongs to seasons played in the franchise (or ones typed in by hand).
    const league = new Map<number, SeasonLeague>();
    for (const season of seasons) {
      if (season.year < franchise.startYear && !capturedYears.has(season.year)) continue;
      league.set(season.year, await seasonLeagueLines(ctx, season, franchise));
    }
    const trends = rankTrends(
      seasonRows(
        captured,
        seasons.flatMap((s) => (s.teamTotals ? [{ year: s.year, stats: s.teamTotals.stats }] : [])),
        [...league].flatMap(([year, { userScreen }]) =>
          userScreen ? [{ year, stats: teamSeasonStatsFromLeague(userScreen) }] : [],
        ),
      ),
    );
    const othersByYear = new Map(
      [...league].map(([year, { lines }]) => [year, lines.filter((l) => l.teamId !== franchise.userTeamId)]),
    );
    return withLeagueStanding(trends, othersByYear);
  },
});

/**
 * Every team's season numbers from the league team stats screen (FEATURES.md 5.5), with the
 * games each team played for per-game figures: its standings record, else the user team's
 * record, else a full regular season. The user team's row is there from its first logged game.
 */
export const leagueBySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      team: vTeamRef,
      isUser: v.boolean(),
      games: v.number(),
      stats: vStatMap,
      fromGames: v.boolean(),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) return [];
    const [{ lines }, teams] = await Promise.all([seasonLeagueLines(ctx, season, franchise), teamsById(ctx)]);
    return lines.flatMap((row) => {
      const team = teams.get(row.teamId);
      if (!team) return [];
      return [
        {
          team: toTeamRef(team),
          isUser: row.teamId === franchise.userTeamId,
          games: row.games,
          stats: row.line,
          fromGames: row.fromGames,
        },
      ];
    });
  },
});
