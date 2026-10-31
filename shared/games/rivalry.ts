/**
 * One rivalry told in full (FEATURES.md 5.6): the games that stand out, the longest runs and who
 * has hurt them most. Also reads a single season's games for its recap. Pure.
 */
import { weekIndex, type GameResult, type WeekKey } from "../domain/calendar";
import { aggregateLines } from "../stats/aggregate";
import type { StatLine } from "../stats/registry";
import { LEADER_STATS } from "../seasons/summary";

export type Meeting = {
  gameId: string;
  year: number;
  weekKey: WeekKey;
  us: number;
  them: number;
  result: GameResult;
};

export type MeetingHighs<M> = {
  bestWin: M | null;
  worstLoss: M | null;
  mostScored: M | null;
  mostAllowed: M | null;
  longestWin: number;
  longestLoss: number;
};

/** The first game holding the top score of `measure`, among those with a positive one. */
function topOf<M>(games: readonly M[], measure: (game: M) => number): M | null {
  let best: M | null = null;
  let top = 0;
  for (const game of games) {
    if (measure(game) > top) {
      best = game;
      top = measure(game);
    }
  }
  return best;
}

function longestRun(games: readonly { result: GameResult }[], result: GameResult) {
  let run = 0;
  let longest = 0;
  for (const game of games) {
    run = game.result === result ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function meetingHighs<M extends Omit<Meeting, "gameId">>(games: readonly M[]): MeetingHighs<M> {
  const ordered = [...games].sort((a, b) => a.year - b.year || weekIndex(a.weekKey) - weekIndex(b.weekKey));
  return {
    bestWin: topOf(ordered, (g) => g.us - g.them),
    worstLoss: topOf(ordered, (g) => g.them - g.us),
    mostScored: topOf(ordered, (g) => g.us),
    mostAllowed: topOf(ordered, (g) => g.them),
    longestWin: longestRun(ordered, "W"),
    longestLoss: longestRun(ordered, "L"),
  };
}

/** Rows each stat lists. */
export const PERFORMERS_SHOWN = 3;

export type AgainstLine<P> = { playerId: P; gameId: string; stats: StatLine };

export type Performers<P> = {
  stat: (typeof LEADER_STATS)[number];
  /** Totals over the meetings, most first. */
  rows: { playerId: P; value: number; games: number }[];
  /** The best single game against them. */
  best: { playerId: P; value: number; gameId: string };
};

/** Our best in each summary stat over these games; a stat nobody recorded is left out. */
export function performersAgainst<P>(lines: readonly AgainstLine<P>[]): Performers<P>[] {
  const byPlayer = new Map<P, AgainstLine<P>[]>();
  for (const line of lines) byPlayer.set(line.playerId, [...(byPlayer.get(line.playerId) ?? []), line]);
  return LEADER_STATS.flatMap((stat) => {
    const best = topOf(lines, (l) => l.stats[stat] ?? 0);
    if (!best) return [];
    const rows = [...byPlayer]
      .map(([playerId, own]) => ({
        playerId,
        value: aggregateLines(own.map((l) => l.stats))[stat] ?? 0,
        games: own.length,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, PERFORMERS_SHOWN);
    return [
      {
        stat,
        rows,
        best: { playerId: best.playerId, value: best.stats[stat] ?? 0, gameId: best.gameId },
      },
    ];
  });
}
