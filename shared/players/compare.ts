/** Compare screen math (FEATURES.md 5.4): which stats two to four careers share, and the radar. Pure. */
import { positionGroupOf, type Position } from "../domain/positions";
import { statValue } from "../stats/aggregate";
import {
  CATEGORY_PRIMARY,
  categoriesForPosition,
  categoriesPlayed,
  statsWithData,
} from "../stats/categories";
import {
  CATEGORY_GROUPS,
  RAW_STAT_CATEGORIES,
  STAT_REGISTRY,
  type StatKey,
  type StatLine,
} from "../stats/registry";

export type Career = { games: number; totals: StatLine };

const MAX_AXES = 6;
const MIN_AXES = 3;

/**
 * Stat keys for the comparison table: the categories that belong to any of the players'
 * positions and that someone played (a quarterback's stray tackle or two career punts do not
 * add a block), in the first player's order (`categoriesForPosition`: his main stats first,
 * fantasy points right after them for a QB, RB, WR or TE, else last).
 */
export function compareStats(positions: readonly Position[], careers: readonly Career[]): StatKey[] {
  const groups = positions.map(positionGroupOf);
  const lead = groups[0];
  const relevant = RAW_STAT_CATEGORIES.filter((c) => groups.some((g) => CATEGORY_GROUPS[c].includes(g)));
  const played = relevant.filter((c) =>
    careers.some((career) => categoriesPlayed([c], career.totals).length > 0),
  );
  if (played.length === 0) return [];
  return statsWithData(
    lead ? categoriesForPosition(lead, [...played, "fantasy"]) : [...played, "fantasy"],
    careers.map((c) => ({ line: c.totals, games: c.games })),
  );
}

/**
 * Radar axes: the defining stats of the leading categories where more is better, up to six.
 * Fewer than three makes no shape, so the radar is skipped (an empty list).
 */
export function radarAxes(stats: readonly StatKey[]): StatKey[] {
  const defining = new Set<StatKey>(Object.values(CATEGORY_PRIMARY).flat());
  const axes = stats
    // Fantasy points sum the other axes, so they would only repeat them.
    .filter(
      (k) =>
        defining.has(k) && STAT_REGISTRY[k].better === "higher" && STAT_REGISTRY[k].category !== "fantasy",
    )
    .slice(0, MAX_AXES);
  return axes.length >= MIN_AXES ? axes : [];
}

/** Each career's value on each axis as a share of the best in the group (0 to 1). */
export function radarValues(axes: readonly StatKey[], careers: readonly Career[]): Record<string, number>[] {
  const value = (key: StatKey, c: Career) => statValue(key, c.totals, { games: c.games }) ?? 0;
  const best = Object.fromEntries(axes.map((k) => [k, Math.max(0, ...careers.map((c) => value(k, c)))]));
  return careers.map((c) =>
    Object.fromEntries(axes.map((k) => [k, best[k]! > 0 ? Math.max(0, value(k, c)) / best[k]! : 0])),
  );
}

/** Per stat, the index of the career that leads it (ties go to the first), honoring `better`. */
export function leaders(stats: readonly StatKey[], careers: readonly Career[]): Map<StatKey, number> {
  const out = new Map<StatKey, number>();
  for (const key of stats) {
    const values = careers.map((c) => statValue(key, c.totals, { games: c.games }));
    let lead = -1;
    values.forEach((v, i) => {
      if (v === null) return;
      const current = lead >= 0 ? values[lead]! : null;
      const better =
        STAT_REGISTRY[key].better === "higher" ? v > (current ?? -Infinity) : v < (current ?? Infinity);
      if (lead < 0 || better) lead = i;
    });
    const known = values.filter((v) => v !== null);
    // A tie for everyone is no lead.
    if (lead >= 0 && careers.length > 1 && new Set(known).size > 1) out.set(key, lead);
  }
  return out;
}
