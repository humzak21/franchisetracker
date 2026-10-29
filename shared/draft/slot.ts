/**
 * Where a pick falls in a Madden draft: seven rounds of 32 with no compensatory picks, so a
 * round and the pick within it give the overall number and the other way round. Pure.
 */
import { DRAFT_ROUNDS } from "../transactions/assets";

export const PICKS_PER_ROUND = 32;
export const DRAFT_PICKS = DRAFT_ROUNDS * PICKS_PER_ROUND;

const whole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/**
 * The overall pick for a round and a pick number, or null when they are not a slot. The pick is
 * the pick within the round (1 to 32); a screen that prints the overall number instead (pick 128
 * in round 4) is read as that, since it can only mean one slot.
 */
export function overallPick(round: unknown, pick: unknown): number | null {
  if (!whole(round) || !whole(pick) || round < 1 || round > DRAFT_ROUNDS) return null;
  const first = (round - 1) * PICKS_PER_ROUND;
  if (pick >= 1 && pick <= PICKS_PER_ROUND) return first + pick;
  return pick > first && pick <= first + PICKS_PER_ROUND ? pick : null;
}

/** The pick within its round for an overall pick: 128 is pick 32 of round 4. */
export function pickInRound(overall: number): number {
  return ((overall - 1) % PICKS_PER_ROUND) + 1;
}
