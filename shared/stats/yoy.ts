/** A player's seasons against each other (`docs/STATS-HUB.md` 4.5). Worked out on read. */
import { loggedValue } from "./ledger";
import { pct } from "./math";
import type { StatKey, StatLine } from "./registry";

export type SeasonFigures = { year: number; gamesPlayed: number; totals: StatLine };

export type YearChange = {
  year: number;
  value: number;
  delta: number | null;
  percent: number | null;
  /** A short season on either side: a two-game cameo should not read as a 400 percent jump. */
  smallSample: boolean;
};

/** Below this many games a season is flagged rather than trusted. */
export const YOY_MIN_GAMES = 8;

/** Each season's value and its change from the season before with a value. Oldest first. */
export function yearOverYear(
  seasons: readonly SeasonFigures[],
  stat: StatKey,
  minGames: number = YOY_MIN_GAMES,
): YearChange[] {
  const ordered = [...seasons].sort((a, b) => a.year - b.year);
  return ordered.map((season, i) => {
    const value = loggedValue(stat, season.totals);
    const prior = ordered[i - 1];
    if (!prior) {
      return {
        year: season.year,
        value,
        delta: null,
        percent: null,
        smallSample: season.gamesPlayed < minGames,
      };
    }
    const before = loggedValue(stat, prior.totals);
    return {
      year: season.year,
      value,
      delta: value - before,
      percent: pct(value - before, before),
      smallSample: season.gamesPlayed < minGames || prior.gamesPlayed < minGames,
    };
  });
}

export type CareerShape = {
  /** The best season for the stat; the earliest when two tie. */
  peak: { year: number; value: number } | null;
  /** Age each season, when a birth year is known. */
  ages: { year: number; age: number | null; value: number }[];
};

export function careerShape(
  seasons: readonly SeasonFigures[],
  stat: StatKey,
  birthYear: number | undefined,
): CareerShape {
  const ordered = [...seasons].sort((a, b) => a.year - b.year);
  const ages = ordered.map((s) => ({
    year: s.year,
    age: birthYear === undefined ? null : s.year - birthYear,
    value: loggedValue(stat, s.totals),
  }));
  const peak = ages.reduce<CareerShape["peak"]>(
    (best, s) => (s.value > 0 && (!best || s.value > best.value) ? { year: s.year, value: s.value } : best),
    null,
  );
  return { peak, ages };
}
