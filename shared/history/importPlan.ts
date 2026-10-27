/**
 * The history import's step plan (docs/NFL-HISTORY.md). A step is a name with an optional
 * argument: "stats:2014" imports one season's totals, "players:1999-2001" the players whose
 * careers ended in those years. The full import plans from scratch; the earlier-years import adds
 * seasons before what an older version of the import brought in, without redoing the rest.
 */
import { NFLVERSE_FIRST_YEAR } from "./nflverse";

export type YearRange = { from: number; to: number };

/** "stats:2014" → ["stats", "2014"]; "careers" → ["careers", undefined]. */
export function splitStep(step: string): [string, string | undefined] {
  const colon = step.indexOf(":");
  return colon === -1 ? [step, undefined] : [step.slice(0, colon), step.slice(colon + 1)];
}

export const rangeStep = (name: string, { from, to }: YearRange) => `${name}:${from}-${to}`;

/** "1999-2001" → { from: 1999, to: 2001 }, else null. */
export function parseRange(arg: string | undefined): YearRange | null {
  const match = /^(\d{4})-(\d{4})$/.exec(arg ?? "");
  if (!match) return null;
  const range = { from: Number(match[1]), to: Number(match[2]) };
  return range.from <= range.to ? range : null;
}

export const inRange = (year: number, range: YearRange | null) =>
  range === null || (year >= range.from && year <= range.to);

/** Every step once the seasons are known. A franchise starting before the covered era gets logos only. */
export function fullPlan(years: readonly number[]): string[] {
  if (years.length === 0) return ["seasons", "media"];
  return ["seasons", "players", ...years.map((y) => `stats:${y}`), "draft", "rosters", "careers", "media"];
}

/**
 * The earlier-years plan for a range and its finished seasons: their standings, the players whose
 * careers ended in the range (the older import kept only later ones), each season's stats, the
 * range's drafts, then career totals again. Rosters and media belong to the first season and stay.
 */
export function earlierPlan(range: YearRange, years: readonly number[]): string[] {
  if (years.length === 0) return [rangeStep("seasons", range)];
  return [
    rangeStep("seasons", range),
    rangeStep("players", range),
    ...years.map((y) => `stats:${y}`),
    rangeStep("draft", range),
    "careers",
  ];
}

/**
 * Seasons nflverse covers before the first one this franchise imported: an import that ran when
 * coverage started in 2002 can add 1999–2001. Null when there is nothing earlier to add.
 */
export function earlierRange(firstImported: number | undefined): YearRange | null {
  if (firstImported === undefined || firstImported <= NFLVERSE_FIRST_YEAR) return null;
  return { from: NFLVERSE_FIRST_YEAR, to: firstImported - 1 };
}
