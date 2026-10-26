/** Aggregation of per-game stat lines into totals, driven by each raw stat's `aggregation`. */
import {
  DERIVED_STATS,
  RAW_STATS,
  type DeriveContext,
  type DerivedStatKey,
  type RawStatKey,
  type StatKey,
  type StatLine,
  isRawStatKey,
} from "./registry";

export function aggregateLines(lines: readonly StatLine[]): StatLine {
  const totals: StatLine = {};
  for (const line of lines) {
    for (const key of Object.keys(line) as RawStatKey[]) {
      const value = line[key];
      if (value === undefined) continue;
      const current = totals[key];
      if (current === undefined) totals[key] = value;
      else totals[key] = RAW_STATS[key].aggregation === "max" ? Math.max(current, value) : current + value;
    }
  }
  return totals;
}

export function computeDerived(line: StatLine, ctx: DeriveContext): Record<DerivedStatKey, number | null> {
  const out = {} as Record<DerivedStatKey, number | null>;
  for (const key of Object.keys(DERIVED_STATS) as DerivedStatKey[]) {
    out[key] = DERIVED_STATS[key].compute(line, ctx);
  }
  return out;
}

/** Value of any stat (raw or derived) for a line. Raw stats that were never recorded return null. */
export function statValue(key: StatKey, line: StatLine, ctx: DeriveContext = { games: 1 }): number | null {
  if (isRawStatKey(key)) return line[key] ?? null;
  return DERIVED_STATS[key].compute(line, ctx);
}
