/**
 * Every team's league team stats line for a season (League → Teams), with the games each team
 * played for per-game figures. The user team always has one once it has played: the league screen's
 * numbers win, and whatever that screen lacks (or the whole line, before it is captured) comes
 * from the team's games (`seasons.teamTotals.league`).
 */
import { SEASON_GAMES, type LeagueTeamLine } from "../../shared/stats/leagueTeamRegistry";
import { userLeagueLine, type LeagueTeamSeason } from "../../shared/stats/teamSeasonLeague";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Every team for one season, with headroom. */
const MAX_TEAMS = 64;

export type SeasonLeagueLine = LeagueTeamSeason & {
  teamId: Id<"teams">;
  /** Some of the numbers come from the team's own games rather than the league screen. */
  fromGames: boolean;
};

export type SeasonLeague = {
  lines: SeasonLeagueLine[];
  /** The user team's numbers as the league screen printed them, without any from the games. */
  userScreen: LeagueTeamSeason | null;
};

const played = (r: { w: number; l: number; t?: number } | undefined) => {
  const n = r ? r.w + r.l + (r.t ?? 0) : 0;
  return n > 0 ? n : null;
};

export async function seasonLeagueLines(
  ctx: QueryCtx,
  season: Doc<"seasons">,
  franchise: Doc<"franchises">,
): Promise<SeasonLeague> {
  const userTeamId = franchise.userTeamId;
  const rows = await ctx.db
    .query("leagueTeamStats")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id))
    .take(MAX_TEAMS);
  const derived = season.teamTotals?.league;
  if (rows.length === 0 && !derived) return { lines: [], userScreen: null };
  const full = franchise.settings.gamesPerSeason ?? SEASON_GAMES;
  const standings =
    season.status === "complete"
      ? []
      : await ctx.db
          .query("standings")
          .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id))
          .take(MAX_TEAMS);
  const record = new Map(standings.map((s) => [s.teamId, s]));
  // A finished season is a full regular season for everyone; standings captured part way through
  // would undercount it. During the season every team has played the same weeks give or take a
  // bye, so the user team's count stands in for a team without standings.
  const fallback = season.status === "complete" ? full : (played(season.userRecord) ?? full);
  const gamesOf = (teamId: Id<"teams">) => played(record.get(teamId)) ?? fallback;
  const lines: SeasonLeagueLine[] = rows
    .filter((row) => row.teamId !== userTeamId)
    .map((row) => ({ teamId: row.teamId, games: gamesOf(row.teamId), line: row.stats, fromGames: false }));
  const screen: LeagueTeamLine | undefined = rows.find((row) => row.teamId === userTeamId)?.stats;
  const user = userLeagueLine(screen, derived);
  // A line wholly from the games covers the games logged.
  const userGames = screen ? gamesOf(userTeamId) : season.teamTotals?.games || fallback;
  if (user) lines.push({ teamId: userTeamId, games: userGames, ...user });
  return { lines, userScreen: screen ? { line: screen, games: userGames } : null };
}
