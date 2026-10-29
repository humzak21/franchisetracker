/** Which stats a table shows: the ones with data, and the few that stay visible on a phone. */
import type { PositionGroup } from "../domain/positions";
import { statValue } from "./aggregate";
import {
  CATEGORY_GROUPS,
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

/**
 * The skill positions' main stats, in the order their tables lead with: a receiver's catches
 * before his carries, a back's carries before his catches. Fantasy points follow the first.
 */
const MAIN_CATEGORIES: Partial<Record<PositionGroup, readonly StatCategory[]>> = {
  QB: ["passing", "rushing"],
  RB: ["rushing", "receiving"],
  WR: ["receiving", "rushing"],
  TE: ["receiving", "rushing"],
};

/**
 * Categories in the order a player's tables show them: his position's main stats first (a QB's
 * passing, a back's rushing, a receiver's receiving), then the rest of his own categories, then
 * everything else, each group in the order given. Fantasy points come right after the main
 * stats for a QB, RB, WR or TE and last for everyone else; it is only placed if it was given.
 */
export function categoriesForPosition(
  group: PositionGroup,
  categories: readonly StatCategory[],
): StatCategory[] {
  const given = new Set(categories);
  const main = (MAIN_CATEGORIES[group] ?? []).filter((c) => given.has(c));
  const others = categories.filter((c) => c !== "fantasy" && !main.includes(c));
  const own = others.filter((c) => CATEGORY_GROUPS[c].includes(group));
  const rest = others.filter((c) => !own.includes(c));
  const fantasy: StatCategory[] = given.has("fantasy") ? ["fantasy"] : [];
  return main.length > 0
    ? [main[0]!, ...fantasy, ...main.slice(1), ...own, ...rest]
    : [...own, ...rest, ...fantasy];
}

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
