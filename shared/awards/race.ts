/**
 * The awards race (FEATURES.md 5.8): who leads MVP, OPOY, DPOY and OROY on the season's numbers.
 * Madden picks the real winners, so this is the counted awards' rule applied early, never a
 * prediction: most fantasy points on offense, most defensive points on defense. Pure.
 */
import type { AwardType } from "../domain/awards";
import { POSITION_INFO, type Position } from "../domain/positions";
import { starStatLine } from "../games/starLine";
import { aggregateLines } from "../stats/aggregate";
import { fantasyPoints } from "../stats/fantasy";
import { sharedRanks } from "../stats/recordBoards";
import { isStatKey, RAW_STATS, type RawStatKey, type StatLine } from "../stats/registry";

export const RACE_AWARDS = ["MVP", "OPOY", "DPOY", "OROY"] as const satisfies readonly AwardType[];
export type RaceAward = (typeof RACE_AWARDS)[number];

/** Rows each race lists; the user's best joins them from wherever it stands. */
export const RACE_SIZE = 5;

/** A defender's season: fantasy has no individual defense, so the big plays are weighted here. */
const DEFENSE_POINTS: Partial<Record<RawStatKey, number>> = {
  tackles: 1,
  tacklesForLoss: 1,
  sacks: 4,
  defInt: 6,
  passDeflections: 1,
  forcedFumbles: 4,
  fumbleRecoveries: 2,
  safeties: 4,
  defTd: 6,
  blockedKicks: 2,
};

export function defensePoints(line: StatLine): number {
  const entries = Object.entries(DEFENSE_POINTS) as [RawStatKey, number][];
  return entries.reduce((sum, [key, per]) => sum + (line[key] ?? 0) * per, 0);
}

export type RaceEntrant<P, T> = {
  playerId: P;
  teamId: T;
  position: Position;
  rookie: boolean;
  games: number;
  line: StatLine;
  /** Only their top-twenty stats are known, from a league leaders screen. */
  partial: boolean;
};

const offense = (e: { position: Position }) => POSITION_INFO[e.position].side === "offense";
const scoreOffense = (e: { line: StatLine }) => fantasyPoints(e.line) ?? 0;

type Rule = {
  eligible: (e: { position: Position; rookie: boolean }) => boolean;
  score: (e: { line: StatLine }) => number;
};

const RULES: Record<RaceAward, Rule> = {
  MVP: { eligible: offense, score: scoreOffense },
  // A quarterback's numbers would make this the MVP list twice over.
  OPOY: { eligible: (e) => offense(e) && e.position !== "QB", score: scoreOffense },
  DPOY: {
    eligible: (e) => POSITION_INFO[e.position].side === "defense",
    score: (e) => defensePoints(e.line),
  },
  OROY: { eligible: (e) => offense(e) && e.rookie, score: scoreOffense },
};

export type RaceRow<P, T> = {
  rank: number;
  playerId: P;
  teamId: T;
  position: Position;
  value: number;
  /** Points behind the leader. */
  behind: number;
  games: number;
  statLine: string | null;
  partial: boolean;
};

/** One race: the leaders, then the user's best when it is not among them. Zeros never count. */
function board<P, T>(
  award: RaceAward,
  entrants: readonly RaceEntrant<P, T>[],
  isOurs: (teamId: T) => boolean,
): RaceRow<P, T>[] {
  const { eligible, score } = RULES[award];
  const scored = entrants
    .filter(eligible)
    .map((e) => ({ entrant: e, value: score(e) }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
  const leader = scored[0]?.value ?? 0;
  const ranked = sharedRanks(scored, (e) => e.value).map(({ entrant: e, value, rank }) => ({
    rank,
    playerId: e.playerId,
    teamId: e.teamId,
    position: e.position,
    value,
    behind: leader - value,
    games: e.games,
    statLine: starStatLine(e.position, e.line),
    partial: e.partial,
  }));
  const ours = ranked.slice(RACE_SIZE).find((r) => isOurs(r.teamId));
  return [...ranked.slice(0, RACE_SIZE), ...(ours ? [ours] : [])];
}

export function awardsRace<P, T>(
  entrants: readonly RaceEntrant<P, T>[],
  isOurs: (teamId: T) => boolean,
): Record<RaceAward, RaceRow<P, T>[]> {
  return {
    MVP: board("MVP", entrants, isOurs),
    OPOY: board("OPOY", entrants, isOurs),
    DPOY: board("DPOY", entrants, isOurs),
    OROY: board("OROY", entrants, isOurs),
  };
}

/** A line from a player's rows on the league leaders screens: only the stats they are top twenty in. */
export function leaderLine(rows: readonly { statKey: string; value: number }[]): StatLine {
  const line: StatLine = {};
  for (const { statKey, value } of rows) {
    if (isStatKey(statKey) && statKey in RAW_STATS) line[statKey as RawStatKey] = value;
  }
  return line;
}

type Line<P, T> = { playerId: P; teamId: T; gamesPlayed: number; totals: StatLine };
type LeaderRow<P, T> = { playerId?: P; teamId?: T; statKey: string; value: number };

/**
 * Who is in the race: every player with a full season line, summed under the team they finished
 * with, and anyone only the league leaders screens name. A leaders row with no player or team is
 * left out, since nothing can say which award it could count for.
 */
export function raceEntrants<P, T>(
  lines: readonly Line<P, T>[],
  leaders: readonly LeaderRow<P, T>[],
  about: (playerId: P) => { position: Position; rookie: boolean } | null,
): RaceEntrant<P, T>[] {
  const full = new Map<P, { teamId: T; games: number; lines: StatLine[] }>();
  for (const l of lines) {
    const seen = full.get(l.playerId);
    full.set(l.playerId, {
      teamId: l.teamId,
      games: (seen?.games ?? 0) + l.gamesPlayed,
      lines: [...(seen?.lines ?? []), l.totals],
    });
  }
  const named = new Map<P, { teamId: T; rows: LeaderRow<P, T>[] }>();
  for (const row of leaders) {
    if (row.playerId === undefined || row.teamId === undefined || full.has(row.playerId)) continue;
    const seen = named.get(row.playerId);
    named.set(row.playerId, { teamId: row.teamId, rows: [...(seen?.rows ?? []), row] });
  }
  return [
    ...[...full].flatMap(([playerId, p]) => {
      const known = about(playerId);
      if (!known) return [];
      const line = aggregateLines(p.lines);
      return [{ playerId, teamId: p.teamId, ...known, games: p.games, line, partial: false }];
    }),
    ...[...named].flatMap(([playerId, p]) => {
      const known = about(playerId);
      if (!known) return [];
      return [{ playerId, teamId: p.teamId, ...known, games: 0, line: leaderLine(p.rows), partial: true }];
    }),
  ];
}
