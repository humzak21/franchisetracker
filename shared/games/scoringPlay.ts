/** One score of a game: its shape, order and how it reads. Pure; used by Convex and the UI. */
import { isTouchdown, SCORING_KIND_PLAYS, type PatResult, type ScoringKind } from "../domain/scoring";
import { periodLabel, REGULATION_QUARTERS } from "./lineScore";

export type PlayLike<T extends string = string, P extends string = string> = {
  /** 1 to 4 for the quarters, 5 and up for overtime. */
  period: number;
  /** Seconds left in the period. */
  clock: number;
  teamId: T;
  kind: ScoringKind;
  yards?: number;
  playerId?: P;
  /** The scorer as printed; missing where the screen dropped the name. */
  rawName?: string;
  passerId?: P;
  passerName?: string;
  pat?: PatResult;
  homeScore: number;
  awayScore: number;
};

const QUARTER_SECONDS = 15 * 60;
const OVERTIME_SECONDS = 10 * 60;

/** A clock as `m:ss`. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Where a play sits in a game, which is all that ordering and charting it needs. */
export type PlayMoment = Pick<PlayLike, "period" | "clock" | "homeScore" | "awayScore">;

/** Game order: by period, the clock running down, the lower score first when a clock repeats. */
export function comparePlays(a: PlayMoment, b: PlayMoment): number {
  return a.period - b.period || b.clock - a.clock || a.homeScore + a.awayScore - (b.homeScore + b.awayScore);
}

export const inGameOrder = <P extends PlayMoment>(plays: readonly P[]): P[] => [...plays].sort(comparePlays);

const periodSeconds = (period: number) => (period > REGULATION_QUARTERS ? OVERTIME_SECONDS : QUARTER_SECONDS);

/** Seconds played before the start of a period, for placing a score on the game's clock. */
function secondsBefore(period: number): number {
  const quarters = Math.min(period - 1, REGULATION_QUARTERS);
  return quarters * QUARTER_SECONDS + Math.max(0, period - 1 - REGULATION_QUARTERS) * OVERTIME_SECONDS;
}

/** Seconds into the game a score came. */
export const elapsedSeconds = (period: number, clock: number) =>
  secondsBefore(period) + periodSeconds(period) - clock;

/** Seconds a game lasts when it ends with `periods` periods played. */
export const gameLength = (periods: number) => secondsBefore(periods + 1);

/** The period as a label on a play: "Q2", "OT", "2OT". */
export const playPeriodLabel = (period: number) => {
  const label = periodLabel(period - 1);
  return period <= REGULATION_QUARTERS ? `Q${label}` : label;
};

/** "Q4 2:14": when a score came. */
export const playWhen = (play: Pick<PlayLike, "period" | "clock">) =>
  `${playPeriodLabel(play.period)} ${formatClock(play.clock)}`;

/** The players a play names, as resolved names where the caller has them. */
export type PlayNames = { scorer: string | null; passer: string | null };

/**
 * The play in words, from its fields rather than the raw text: "K. Boutte 15 yd pass from D. Maye".
 * A name the screen dropped stays out, so the line still reads: "15 yd pass from D. Maye".
 */
export function describePlay(play: Pick<PlayLike, "kind" | "yards">, names: PlayNames): string {
  const length = play.yards !== undefined ? `${play.yards} yd ` : "";
  const what = `${length}${SCORING_KIND_PLAYS[play.kind]}`;
  const passer = play.kind === "pass_td" && names.passer ? ` from ${names.passer}` : "";
  return `${names.scorer ? `${names.scorer} ` : ""}${what}${passer}`;
}

/** Whether a play still needs a player: a score with no name on it, which only a person can settle. */
export const needsPlayer = (play: Pick<PlayLike, "kind" | "playerId">) =>
  play.playerId === undefined && (isTouchdown(play.kind) || play.kind === "fg");
