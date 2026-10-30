/** The game as a sequence, from its scoring plays (`docs/STATS-HUB.md` 4.10). Pure. */
import { isTouchdown, type ScoringKind } from "../domain/scoring";
import { REGULATION_QUARTERS, type LineScore } from "../games/lineScore";
import {
  elapsedSeconds,
  gameLength,
  inGameOrder,
  type PlayLike,
  type PlayMoment,
} from "../games/scoringPlay";

export type Side = "home" | "away";

/** Points per period per team, from how the score moved rather than what a play should be worth. */
export function lineScoreFromPlays(plays: readonly PlayMoment[]): LineScore {
  const ordered = inGameOrder(plays);
  const periods = Math.max(REGULATION_QUARTERS, ...ordered.map((p) => p.period));
  const line: LineScore = {
    home: Array<number>(periods).fill(0),
    away: Array<number>(periods).fill(0),
  };
  let home = 0;
  let away = 0;
  for (const play of ordered) {
    line.home[play.period - 1]! += play.homeScore - home;
    line.away[play.period - 1]! += play.awayScore - away;
    home = play.homeScore;
    away = play.awayScore;
  }
  return line;
}

export type FlowStep<P extends PlayMoment> = { play: P; margin: number };

export type GameFlow<P extends PlayMoment> = {
  steps: FlowStep<P>[];
  leadChanges: number;
  ties: number;
  largestLead: Record<Side, number>;
  firstScore: Side | null;
  winner: Side | null;
  /** The last score that put the winner ahead for good. */
  gameWinner: P | null;
  /** The most the winner trailed by; the most the loser led by. */
  deficitOvercome: number;
  /** The winner was behind going into the fourth quarter. */
  comeback: boolean;
};

const sideOf = (margin: number): Side | null => (margin > 0 ? "home" : margin < 0 ? "away" : null);

/** The score after every play and what the sequence adds up to. */
export function gameFlow<P extends PlayMoment>(plays: readonly P[]): GameFlow<P> {
  const steps = inGameOrder(plays).map((play) => ({ play, margin: play.homeScore - play.awayScore }));
  const largestLead: Record<Side, number> = { home: 0, away: 0 };
  let leader: Side | null = null;
  let leadChanges = 0;
  let ties = 0;
  for (const { margin } of steps) {
    const side = sideOf(margin);
    if (!side) ties++;
    else {
      largestLead[side] = Math.max(largestLead[side], Math.abs(margin));
      if (leader && side !== leader) leadChanges++;
      leader = side;
    }
  }
  const last = steps.at(-1);
  const winner = last ? sideOf(last.margin) : null;
  const firstStep = steps[0];
  const firstScore = firstStep ? sideOf(firstStep.margin) : null;
  if (!winner) {
    return {
      steps,
      leadChanges,
      ties,
      largestLead,
      firstScore,
      winner,
      gameWinner: null,
      deficitOvercome: 0,
      comeback: false,
    };
  }
  const loser: Side = winner === "home" ? "away" : "home";
  const ahead = (margin: number) => sideOf(margin) === winner;
  const lastBehind = steps.findLastIndex((s) => !ahead(s.margin));
  const beforeFourth = steps.findLast((s) => s.play.period < REGULATION_QUARTERS);
  return {
    steps,
    leadChanges,
    ties,
    largestLead,
    firstScore,
    winner,
    gameWinner: steps[lastBehind + 1]?.play ?? null,
    deficitOvercome: largestLead[loser],
    comeback: beforeFourth !== undefined && sideOf(beforeFourth.margin) === loser,
  };
}

export type WormPoint = { seconds: number; margin: number };

/**
 * The margin over game time from the user's side, starting level at kickoff and held to the end
 * of the game. `playIndex` ties a point to its play, in game order.
 */
export function wormPoints(
  plays: readonly PlayMoment[],
  userIsHome: boolean,
): (WormPoint & { playIndex: number | null })[] {
  const ordered = inGameOrder(plays);
  const periods = Math.max(REGULATION_QUARTERS, ...ordered.map((p) => p.period));
  const margin = (p: PlayMoment) => (p.homeScore - p.awayScore) * (userIsHome ? 1 : -1);
  const last = ordered.at(-1);
  return [
    { seconds: 0, margin: 0, playIndex: null },
    ...ordered.map((p, playIndex) => ({
      seconds: elapsedSeconds(p.period, p.clock),
      margin: margin(p),
      playIndex,
    })),
    { seconds: gameLength(periods), margin: last ? margin(last) : 0, playIndex: null },
  ];
}

/** Touchdowns per period for one player's plays in one game. */
export function touchdownsByPeriod(plays: readonly Pick<PlayLike, "period" | "kind">[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const play of plays) {
    if (isTouchdown(play.kind)) out.set(play.period, (out.get(play.period) ?? 0) + 1);
  }
  return out;
}

export type Connection<P extends string> = { passerId: P; playerId: P; touchdowns: number; yards: number };

/** Passer-to-scorer pairs with their touchdowns and yards, most touchdowns first. */
export function connections<P extends string>(plays: readonly PlayLike<string, P>[]): Connection<P>[] {
  const pairs = new Map<string, Connection<P>>();
  for (const { kind, passerId, playerId, yards } of plays) {
    if (kind !== "pass_td" || !passerId || !playerId) continue;
    const key = `${passerId}|${playerId}`;
    const pair = pairs.get(key) ?? { passerId, playerId, touchdowns: 0, yards: 0 };
    pair.touchdowns++;
    pair.yards += yards ?? 0;
    pairs.set(key, pair);
  }
  return [...pairs.values()].sort((a, b) => b.touchdowns - a.touchdowns || b.yards - a.yards);
}

/** The kinds a "longest" record is kept for, in the order the lists show. */
export const LONGEST_KINDS = [
  "pass_td",
  "rush_td",
  "fg",
  "int_td",
  "fumble_td",
  "kick_return_td",
  "punt_return_td",
] as const satisfies readonly ScoringKind[];
