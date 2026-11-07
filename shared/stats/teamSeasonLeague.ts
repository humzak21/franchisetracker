/**
 * Where a team season stat stood in the league: each stat on the Team stats cards read from a
 * league team stats line (League → Teams), and a value ranked against the other teams with the
 * league average beside it. Pure.
 */
import { leagueTeamValue, type LeagueTeamLine, type LeagueTeamStatKey } from "./leagueTeamRegistry";
import { TEAM_SEASON_STAT_KEYS, TEAM_SEASON_STATS, type TeamSeasonStatKey } from "./teamSeasonRegistry";
import type { RankPoint, StatTrend } from "./teamTrends";

/** One team's league line for a season, with the games it played for per-game figures. */
export type LeagueTeamSeason = { line: LeagueTeamLine; games: number };

/** The league stat each card reads, per game for the per-game cards. Penalties are not on the league screen. */
const FROM_LEAGUE: Record<TeamSeasonStatKey, { key: LeagueTeamStatKey; perGame: boolean } | null> = {
  pointsPg: { key: "pointsPg", perGame: false },
  yardsPg: { key: "offYds", perGame: true },
  passYardsPg: { key: "passYds", perGame: true },
  rushYardsPg: { key: "rushYds", perGame: true },
  firstDownsPg: { key: "firstDowns", perGame: true },
  thirdDownPct: { key: "thirdDownPct", perGame: false },
  redZonePct: { key: "redZonePct", perGame: false },
  pointsAllowedPg: { key: "pointsAllowedPg", perGame: false },
  yardsAllowedPg: { key: "yardsAllowed", perGame: true },
  passYardsAllowedPg: { key: "passYdsAllowed", perGame: true },
  rushYardsAllowedPg: { key: "rushYdsAllowed", perGame: true },
  sacks: { key: "sacks", perGame: false },
  takeaways: { key: "takeaways", perGame: false },
  giveaways: { key: "giveaways", perGame: false },
  turnoverDiff: { key: "turnoverDiff", perGame: false },
  penaltiesPg: null,
};

export function teamSeasonFromLeague(statKey: TeamSeasonStatKey, team: LeagueTeamSeason): number | null {
  const source = FROM_LEAGUE[statKey];
  return source ? leagueTeamValue(source.key, team.line, { games: team.games }, source.perGame) : null;
}

/** Every card a league line has a value for. */
export function teamSeasonStatsFromLeague(
  team: LeagueTeamSeason,
): Partial<Record<TeamSeasonStatKey, number>> {
  return Object.fromEntries(
    TEAM_SEASON_STAT_KEYS.flatMap((key) => {
      const value = teamSeasonFromLeague(key, team);
      return value === null ? [] : [[key, value]];
    }),
  );
}

export type LeagueStanding = { rank: number; tied: boolean; of: number; average: number };

/** Fewer teams than this is not a league to rank in (a tab captured for a handful of teams). */
export const MIN_RANKED_TEAMS = 8;

/**
 * `value`'s rank among the other teams' values by the stat's good direction, compared as shown
 * (to the stat's decimals) so 24.21 and 24.24 tie the way the screen would print them. The
 * average includes `value`. Null when too few teams have the stat.
 */
export function leagueStanding(
  statKey: TeamSeasonStatKey,
  value: number,
  others: readonly number[],
): LeagueStanding | null {
  if (others.length + 1 < MIN_RANKED_TEAMS) return null;
  const { decimals, better } = TEAM_SEASON_STATS[statKey];
  const shown = (n: number) => Math.round(n * 10 ** decimals);
  const ours = shown(value);
  const ahead = others.filter((o) => (better === "higher" ? shown(o) > ours : shown(o) < ours)).length;
  const all = [...others, value];
  return {
    rank: ahead + 1,
    tied: others.some((o) => shown(o) === ours),
    of: all.length,
    average: all.reduce((a, b) => a + b, 0) / all.length,
  };
}

/** Every other team's value for the stat, from their league lines; teams without it are left out. */
export function leagueValues(statKey: TeamSeasonStatKey, teams: readonly LeagueTeamSeason[]): number[] {
  return teams.flatMap((team) => {
    const value = teamSeasonFromLeague(statKey, team);
    return value === null ? [] : [value];
  });
}

/**
 * The user team's league line: what the league screen printed, with any column it lacks filled
 * from the team's games. `fromGames` says whether any number came from the games.
 */
export function userLeagueLine(
  screen: LeagueTeamLine | undefined,
  games: LeagueTeamLine | undefined,
): { line: LeagueTeamLine; fromGames: boolean } | null {
  if (!screen && !games) return null;
  const line = { ...games, ...screen };
  const fromGames = Object.keys(games ?? {}).some((key) => !(key in (screen ?? {})));
  return { line, fromGames };
}

/** A season point with where it stood: the league rank and how many teams it was ranked among, and the league average. */
export type LeaguePoint = RankPoint & {
  of: number | null;
  average: number | null;
  /** The rank was worked out from League → Teams rather than captured or typed. */
  rankFromLeague: boolean;
};

/**
 * Each season's value placed among the other teams' lines that season. A rank captured from the
 * team's own stats screen wins over the one worked out here; the average needs the league lines.
 */
export function withLeagueStanding(
  trends: readonly StatTrend[],
  othersByYear: ReadonlyMap<number, readonly LeagueTeamSeason[]>,
): { statKey: TeamSeasonStatKey; points: LeaguePoint[] }[] {
  return trends.map(({ statKey, points }) => ({
    statKey,
    points: points.map((point) => {
      const others = othersByYear.get(point.year);
      const standing = others ? leagueStanding(statKey, point.value, leagueValues(statKey, others)) : null;
      const league = { of: standing?.of ?? null, average: standing?.average ?? null };
      if (point.rank !== null || !standing) return { ...point, ...league, rankFromLeague: false };
      return { ...point, ...league, rank: standing.rank, tied: standing.tied, rankFromLeague: true };
    }),
  }));
}
