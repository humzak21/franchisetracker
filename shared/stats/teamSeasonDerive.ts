/**
 * The user team's season team stats derived from its games, the way player season totals come
 * from game logs: points from the scores, everything else from each game's team stats screen
 * (the user's side for offense, the opponent's side for what the defense allowed). Season values
 * captured from the team stats screen or entered by hand override these per stat
 * (`teamTrends.seasonRows`). Pure.
 */
import { offensiveYards, type TeamStatKey, type TeamStatLine } from "./teamRegistry";
import type { TeamSeasonStatKey } from "./teamSeasonRegistry";

/** One scored regular-season game; a side's line is null when its team stats were not captured. */
export type TeamSeasonGame = {
  pointsFor: number;
  pointsAgainst: number;
  own: TeamStatLine | null;
  opponent: TeamStatLine | null;
};

export type TeamSeasonTotals = {
  /** Scored games, which the points averages cover. */
  games: number;
  /** Games with the team stats screen captured, which every other figure covers. */
  statGames: number;
  stats: Partial<Record<TeamSeasonStatKey, number>>;
};

const defined = (values: readonly (number | undefined)[]) =>
  values.filter((n): n is number => n !== undefined);

function mean(values: readonly (number | undefined)[]): number | undefined {
  const list = defined(values);
  return list.length === 0 ? undefined : list.reduce((a, b) => a + b, 0) / list.length;
}

function sum(values: readonly (number | undefined)[]): number | undefined {
  const list = defined(values);
  return list.length === 0 ? undefined : list.reduce((a, b) => a + b, 0);
}

/** Made over attempted as a percentage, from games that recorded both; undefined without attempts. */
function rate(lines: readonly TeamStatLine[], made: TeamStatKey, attempts: TeamStatKey): number | undefined {
  let m = 0;
  let a = 0;
  for (const line of lines) {
    const lineMade = line[made];
    const lineAttempts = line[attempts];
    if (lineMade === undefined || lineAttempts === undefined) continue;
    m += lineMade;
    a += lineAttempts;
  }
  return a > 0 ? (100 * m) / a : undefined;
}

/** Turnovers as printed, else interceptions plus fumbles lost when both were read. */
function turnovers(line: TeamStatLine): number | undefined {
  if (line.turnovers !== undefined) return line.turnovers;
  return line.intThrown !== undefined && line.fumblesLost !== undefined
    ? line.intThrown + line.fumblesLost
    : undefined;
}

export function deriveTeamSeason(games: readonly TeamSeasonGame[]): TeamSeasonTotals {
  const own = games.flatMap((g) => (g.own ? [offensiveYards(g.own)] : []));
  const opponent = games.flatMap((g) => (g.opponent ? [offensiveYards(g.opponent)] : []));
  const takeaways = sum(opponent.map(turnovers));
  const giveaways = sum(own.map(turnovers));
  const stats: Partial<Record<TeamSeasonStatKey, number | undefined>> = {
    pointsPg: mean(games.map((g) => g.pointsFor)),
    pointsAllowedPg: mean(games.map((g) => g.pointsAgainst)),
    yardsPg: mean(own.map((l) => l.totalYds)),
    passYardsPg: mean(own.map((l) => l.passYds)),
    rushYardsPg: mean(own.map((l) => l.rushYds)),
    firstDownsPg: mean(own.map((l) => l.firstDowns)),
    thirdDownPct: rate(own, "thirdDownConv", "thirdDownAtt"),
    redZonePct: rate(own, "redZoneTd", "redZoneAtt"),
    penaltiesPg: mean(own.map((l) => l.penalties)),
    yardsAllowedPg: mean(opponent.map((l) => l.totalYds)),
    passYardsAllowedPg: mean(opponent.map((l) => l.passYds)),
    rushYardsAllowedPg: mean(opponent.map((l) => l.rushYds)),
    // The defense's sacks are the sacks the other offense allowed.
    sacks: sum(opponent.map((l) => l.sacksAllowed)),
    takeaways,
    giveaways,
    turnoverDiff: takeaways !== undefined && giveaways !== undefined ? takeaways - giveaways : undefined,
  };
  return {
    games: games.length,
    statGames: games.filter((g) => g.own || g.opponent).length,
    stats: Object.fromEntries(Object.entries(stats).filter(([, value]) => value !== undefined)),
  };
}
