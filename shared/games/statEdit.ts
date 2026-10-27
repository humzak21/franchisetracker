/** One cell of a hand-edited stat line (box score, team stats, a player's game log). Pure. */

/** Game numbers stay small; the same ceiling the review screen applies to a draft. */
export const MAX_GAME_STAT = 100_000;

/** Whole or half numbers (sacks), negatives allowed (a loss on a run), within the ceiling. */
export function validGameStat(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) < MAX_GAME_STAT && Number.isInteger(value * 2);
}

/** The stat map with one key set, or removed when `value` is null. Never mutates the input. */
export function withStat(
  stats: Readonly<Record<string, number>>,
  key: string,
  value: number | null,
): Record<string, number> {
  const next = { ...stats };
  if (value === null) delete next[key];
  else next[key] = value;
  return next;
}
