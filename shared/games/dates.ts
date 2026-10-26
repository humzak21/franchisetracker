/**
 * Where a season's weeks fall on the calendar. Games carry a week, not a date, so the calendar
 * view places each week on the Sunday the real NFL plays it: Week 1 is the Sunday after Labor
 * Day, the playoffs follow Week 18, the Pro Bowl takes the open Sunday and the Super Bowl the
 * one after. Dates are UTC midnights so they never shift with the viewer's time zone.
 */
import { WEEK_KEYS, weekIndex, type WeekKey } from "../domain/calendar";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** Weeks after Week 1 for the keys that do not follow one another directly. */
const OFFSET_AFTER_W1: Partial<Record<WeekKey, number>> = {
  pre1: -3,
  pre2: -2,
  pre3: -1,
  probowl: 21,
  sb: 22,
};

/** The first Monday of September: Labor Day. */
function laborDay(year: number): Date {
  const first = new Date(Date.UTC(year, 8, 1));
  const toMonday = (8 - first.getUTCDay()) % 7;
  return new Date(Date.UTC(year, 8, 1 + toMonday));
}

/** Sunday of Week 1 for the season named by its kickoff year. */
export function weekOneSunday(year: number): Date {
  return new Date(laborDay(year).getTime() + 6 * DAY);
}

/** The Sunday a week is played. */
export function weekDate(year: number, week: WeekKey): Date {
  const offset = OFFSET_AFTER_W1[week] ?? weekIndex(week) - weekIndex("w1");
  return new Date(weekOneSunday(year).getTime() + offset * WEEK);
}

/** The week played on a given UTC date, if any. */
export function weekOn(year: number, date: Date): WeekKey | null {
  return WEEK_KEYS.find((week) => weekDate(year, week).getTime() === date.getTime()) ?? null;
}

export type OffseasonMarker = { key: "free_agency" | "draft"; label: string; date: Date };

/** The offseason dates after a season: free agency opens mid-March, the draft is the last Thursday of April. */
export function offseasonMarkers(year: number): OffseasonMarker[] {
  const next = year + 1;
  const march1 = new Date(Date.UTC(next, 2, 1));
  // The new league year starts on the second Wednesday of March.
  const firstWednesday = 1 + ((3 - march1.getUTCDay() + 7) % 7);
  const april30 = new Date(Date.UTC(next, 3, 30));
  const lastThursday = 30 - ((april30.getUTCDay() - 4 + 7) % 7);
  return [
    { key: "free_agency", label: "Free agency", date: new Date(Date.UTC(next, 2, firstWednesday + 7)) },
    { key: "draft", label: "Draft", date: new Date(Date.UTC(next, 3, lastThursday)) },
  ];
}

export type CalendarMonth = {
  /** UTC year and zero-based month. */
  year: number;
  month: number;
  /** Rows of seven days, Sunday first; null pads the first and last rows. */
  weeks: (Date | null)[][];
};

/** One month as a Sunday-first grid. */
export function monthGrid(year: number, month: number): CalendarMonth {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (Date | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(Date.UTC(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, weeks };
}

/** Every month from the first preseason week to the draft. */
export function seasonMonths(year: number): CalendarMonth[] {
  const start = weekDate(year, "pre1");
  const end = offseasonMarkers(year).at(-1)!.date;
  const first = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const last = end.getUTCFullYear() * 12 + end.getUTCMonth();
  return Array.from({ length: last - first + 1 }, (_, i) =>
    monthGrid(Math.floor((first + i) / 12), (first + i) % 12),
  );
}

/** Key for matching dates across the grid and the schedule ("2026-09-13"). */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
