/** Which stats a table shows: the ones with data, and the few that stay visible on a phone. */
import { statValue } from "./aggregate";
import {
  isRawStatKey,
  STAT_REGISTRY,
  statsInCategory,
  type StatCategory,
  type StatKey,
  type StatLine,
} from "./registry";

/** The stats that define each category, kept in the phone table; the rest go in the expand card. */
export const CATEGORY_PRIMARY: Record<StatCategory, StatKey[]> = {
  passing: ["passCmp", "passAtt", "passYds", "passTd", "passInt"],
  rushing: ["rushAtt", "rushYds", "rushTd"],
  receiving: ["rec", "recYds", "recTd"],
  defense: ["tackles", "sacks", "defInt"],
  kicking: ["fgm", "fga", "xpm"],
  punting: ["punts", "puntYds", "puntAvg"],
  returns: ["kickReturnYds", "puntReturnYds"],
  fantasy: ["fantasyPts"],
};

type Row = { line: StatLine; games?: number };

/** Recorded for someone. A recorded zero counts: a box score's 0 INT is data, not a gap. */
const recorded = (rows: readonly Row[], key: StatKey) =>
  rows.some((r) => statValue(key, r.line, { games: r.games ?? 1 }) !== null);

/**
 * Stats in these categories worth a column: raw stats someone recorded, and derived stats
 * whose inputs were all recorded. Registry order within each category. A single game leaves
 * out per-game rates, which would only repeat the totals.
 */
export function statsWithData(
  categories: readonly StatCategory[],
  rows: readonly Row[],
  { singleGame = false }: { singleGame?: boolean } = {},
): StatKey[] {
  return categories.flatMap((category) =>
    statsInCategory(category).filter((key) => {
      const def = STAT_REGISTRY[key];
      if (def.kind === "raw") return recorded(rows, key);
      if (singleGame && def.perGame) return false;
      return def.dependsOn.every((dep) => recorded(rows, dep));
    }),
  );
}

/** Categories with at least one nonzero stat in these lines. */
export function categoriesWithData(
  categories: readonly StatCategory[],
  rows: readonly Row[],
): StatCategory[] {
  return categories.filter((c) =>
    statsInCategory(c).some((key) => rows.some((r) => (statValue(key, r.line) ?? 0) !== 0)),
  );
}

/**
 * Categories the player actually played in this line: a nonzero raw stat. Unlike
 * `categoriesWithData`, derived stats do not count, so a receiver's scrimmage yards do not put
 * him in the rushing category.
 */
export function categoriesPlayed(categories: readonly StatCategory[], line: StatLine): StatCategory[] {
  return categories.filter((c) => statsInCategory(c).some((k) => isRawStatKey(k) && (line[k] ?? 0) !== 0));
}
