/**
 * Team season stats. `trends` is the user team's rank ribbons: per stat, the value captured from
 * the team stats screen (or its manual entry), else the one derived from the season's games
 * (`seasons.teamTotals`), with the league rank wherever one was captured. `leagueBySeason` is
 * every team's numbers from the league team stats screen.
 */
import { v } from "convex/values";
import { SEASON_GAMES } from "../../shared/stats/leagueTeamRegistry";
import { TEAM_SEASON_STAT_KEYS } from "../../shared/stats/teamSeasonRegistry";
import { rankTrends, seasonRows } from "../../shared/stats/teamTrends";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { franchiseSeasonList } from "../lib/reports";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { literals, vStatMap } from "../lib/validators";

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

/** Every team for one season, with headroom. */
const MAX_TEAMS = 64;

/**
 * Every team's season numbers from the league team stats screen (FEATURES.md 5.5), with the
 * games each team played for per-game figures: its standings record, else the user team's
 * record, else a full regular season.
 */
export const leagueBySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      team: vTeamRef,
      isUser: v.boolean(),
      games: v.number(),
      stats: vStatMap,
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [rows, standings, season, teams] = await Promise.all([
      ctx.db
        .query("leagueTeamStats")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId))
        .take(MAX_TEAMS),
      ctx.db
        .query("standings")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId))
        .take(MAX_TEAMS),
      ctx.db.get("seasons", seasonId),
      teamsById(ctx),
    ]);
    const played = (r: { w: number; l: number; t?: number } | undefined) =>
      r && r.w + r.l + (r.t ?? 0) > 0 ? r.w + r.l + (r.t ?? 0) : null;
    const record = new Map(standings.map((s) => [s.teamId, s]));
    // Every team has played the same weeks give or take a bye, so the user team's count stands in.
    const fallback = played(season?.userRecord);
    return rows.flatMap((row) => {
      const team = teams.get(row.teamId);
      if (!team) return [];
      return [
        {
          team: toTeamRef(team),
          isUser: row.teamId === franchise.userTeamId,
          games: played(record.get(row.teamId)) ?? fallback ?? SEASON_GAMES,
          stats: row.stats,
        },
      ];
    });
  },
});
