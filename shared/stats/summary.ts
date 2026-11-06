/** Summary statistics over a list of numbers, such as a player's recent games. Pure. */

export type Summary = {
  count: number;
  total: number;
  mean: number;
  median: number;
  /** The most frequent value (the lowest on a tie), or null when no value repeats. */
  mode: number | null;
  modeCount: number;
  /** Population standard deviation: how far a typical value sits from the mean. */
  stdDev: number;
  max: number;
  min: number;
  /** Index of the first value at the max and at the min. */
  maxAt: number;
  minAt: number;
};

/** Null for an empty list, so callers never divide by zero. */
export function summarize(values: readonly number[]): Summary | null {
  const count = values.length;
  if (count === 0) return null;
  const total = values.reduce((n, v) => n + v, 0);
  const mean = total / count;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;

  const tally = new Map<number, number>();
  for (const v of sorted) tally.set(v, (tally.get(v) ?? 0) + 1);
  let mode: number | null = null;
  let modeCount = 1;
  for (const [v, n] of tally) {
    if (n > modeCount) [mode, modeCount] = [v, n];
  }

  const variance = values.reduce((n, v) => n + (v - mean) ** 2, 0) / count;
  const max = sorted.at(-1)!;
  const min = sorted[0]!;
  return {
    count,
    total,
    mean,
    median,
    mode,
    modeCount: mode === null ? 0 : modeCount,
    stdDev: Math.sqrt(variance),
    max,
    min,
    maxAt: values.indexOf(max),
    minAt: values.indexOf(min),
  };
}
