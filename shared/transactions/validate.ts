/** Whether a move's shape makes sense before anything is written (FEATURES.md 5.10). Pure. */
import type { TransactionType } from "../domain";

/** Headroom for blockbuster trades without unbounded writes. */
export const MAX_TRADE_PLAYERS = 15;
export const MAX_TRADE_PICKS = 14;

type Shape<T> = {
  type: TransactionType;
  teamId: T;
  counterpartTeamId?: T;
  playersIn: readonly unknown[];
  playersOut: readonly unknown[];
  picksIn: readonly unknown[];
  picksOut: readonly unknown[];
};

/** Why a move cannot be saved as entered, or null. */
export function moveShapeError<T>(move: Shape<T>): string | null {
  const players = move.playersIn.length + move.playersOut.length;
  const picks = move.picksIn.length + move.picksOut.length;
  if (move.counterpartTeamId !== undefined && move.counterpartTeamId === move.teamId)
    return "Pick two different teams";
  if (move.type !== "trade") {
    if (players !== 1) return "Pick one player";
    return picks > 0 ? "Only trades move picks" : null;
  }
  if (move.counterpartTeamId === undefined) return "Pick the other team";
  if (players + picks === 0) return "Add what each team sends";
  if (Math.max(move.playersIn.length, move.playersOut.length) > MAX_TRADE_PLAYERS)
    return `Up to ${MAX_TRADE_PLAYERS} players a side`;
  if (Math.max(move.picksIn.length, move.picksOut.length) > MAX_TRADE_PICKS)
    return `Up to ${MAX_TRADE_PICKS} picks a side`;
  return null;
}
