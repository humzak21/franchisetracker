/** One stat's value across seasons: bar geometry, the change from last season and the best season. */

export type SeasonValue = { year: number; value: number };

/** Percent of the chart height, measured from the bottom. */
export type BarBox = { bottom: number; height: number };

/**
 * Bars measured from zero, so a negative season (a turnover differential) hangs below the zero
 * line instead of a stretched axis exaggerating small differences.
 */
export function seasonBars(values: readonly number[]): { zero: number; bars: BarBox[] } {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const pct = (v: number) => (v / span) * 100;
  const zero = pct(0 - lo);
  return {
    zero,
    bars: values.map((v) =>
      v >= 0 ? { bottom: zero, height: pct(v) } : { bottom: zero + pct(v), height: pct(-v) },
    ),
  };
}

/** The latest season before `year` with a value. */
export function previousSeason<T extends SeasonValue>(points: readonly T[], year: number): T | null {
  return points
    .filter((p) => p.year < year)
    .reduce<T | null>((a, b) => (!a || b.year > a.year ? b : a), null);
}

/**
 * Whether `year` is the best of at least `min` seasons (ties count), by the stat's good direction.
 * Two seasons are too few to call one the best.
 */
export function isBestSeason(
  points: readonly SeasonValue[],
  year: number,
  better: "higher" | "lower",
  min = 3,
): boolean {
  const current = points.find((p) => p.year === year);
  if (!current || points.length < min) return false;
  const values = points.map((p) => p.value);
  return current.value === (better === "higher" ? Math.max(...values) : Math.min(...values));
}
