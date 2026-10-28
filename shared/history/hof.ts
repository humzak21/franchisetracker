/** Hall of Fame (FEATURES.md 5.7): the jersey wall's order, retired numbers and each plaque's stats. Pure. */
import { positionGroupOf, type Position, type PositionGroup } from "../domain/positions";
import { statValue } from "../stats/aggregate";
import { categoriesPlayed } from "../stats/categories";
import { STAT_CATEGORIES, type StatCategory, type StatKey, type StatLine } from "../stats/registry";

/** The numbers a plaque leads with, per category: the ones a career is remembered by. */
const HEADLINE: Record<StatCategory, StatKey[]> = {
  passing: ["passYds", "passTd", "passRating"],
  rushing: ["rushYds", "rushTd", "rushAvg"],
  receiving: ["rec", "recYds", "recTd"],
  defense: ["tackles", "sacks", "defInt"],
  kicking: ["fgm", "fgPct", "fgLong"],
  punting: ["punts", "puntAvg", "puntIn20"],
  returns: ["kickReturnYds", "puntReturnYds", "kickReturnTd"],
  fantasy: ["fantasyPts", "fantasyPpg"],
};

/** The category a position is judged by; linemen and snappers have none in a box score. */
const PRIMARY: Partial<Record<PositionGroup, StatCategory>> = {
  QB: "passing",
  RB: "rushing",
  WR: "receiving",
  TE: "receiving",
  DL: "defense",
  LB: "defense",
  DB: "defense",
  K: "kicking",
  P: "punting",
};

const MAX_HEADLINES = 3;

export type Headline = { stat: StatKey; value: number };

/**
 * Up to three career numbers for a plaque: the position's own category first (a receiver's
 * catches before his carries), then anything else they played. Zeros are left out.
 */
export function headlineStats(position: Position, totals: StatLine, games: number): Headline[] {
  const primary = PRIMARY[positionGroupOf(position)];
  const played = categoriesPlayed(STAT_CATEGORIES, totals);
  const ordered = [...played.filter((c) => c === primary), ...played.filter((c) => c !== primary)];
  const out: Headline[] = [];
  for (const stat of ordered.flatMap((c) => HEADLINE[c])) {
    const value = statValue(stat, totals, { games });
    if (value !== null && value !== 0) out.push({ stat, value });
    if (out.length === MAX_HEADLINES) break;
  }
  return out;
}

/** "2026–2034", "2026", or "" when the years are unknown. */
export function careerSpan(first: number | undefined, last: number | undefined): string {
  if (first === undefined || last === undefined) return first === undefined ? "" : String(first);
  return first === last ? String(first) : `${first}–${last}`;
}

type WallEntry = { inductedYear: number; name: string; jersey?: number; retiredNumber: boolean };

/** The wall reads in induction order, oldest class first, alphabetical within a class. */
export function wallOrder<T extends WallEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.inductedYear - b.inductedYear || a.name.localeCompare(b.name));
}

/** Retired numbers, lowest first; a number retired twice keeps both names. */
export function retiredNumbers<T extends WallEntry>(entries: readonly T[]): (T & { jersey: number })[] {
  return entries
    .filter((e): e is T & { jersey: number } => e.retiredNumber && e.jersey !== undefined)
    .sort((a, b) => a.jersey - b.jersey || a.inductedYear - b.inductedYear);
}
