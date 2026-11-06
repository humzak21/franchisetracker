/**
 * Madden's calendar in the app's terms: a save counts seasons from the year the franchise
 * started (`SeasonInfo.BaseCalendarYear`) and weeks from 0 within a week type.
 */
import { isWeekKey, type WeekKey } from "../../shared/domain/calendar";

/** The week key for a Madden week type and 0-based week, or null for weeks the app has no slot for. */
export function weekKeyOf(weekType: string, week: number): WeekKey | null {
  const key = (() => {
    switch (weekType) {
      case "PreSeason":
        return `pre${week + 1}`;
      case "RegularSeason":
        return `w${week + 1}`;
      case "WildcardPlayoff":
        return "wc";
      case "DivisionalPlayoff":
        return "div";
      case "ConferencePlayoff":
        return "conf";
      case "SuperBowl":
        return "sb";
      default:
        return null;
    }
  })();
  return key !== null && isWeekKey(key) ? key : null;
}

/**
 * The week key of a season-wide week index (weekly awards count 0 to 22 across the regular
 * season and the playoffs, with the Pro Bowl between the conference round and the Super Bowl).
 */
export function seasonWeekKey(index: number): WeekKey | null {
  if (index < 18) return weekKeyOf("RegularSeason", index);
  const playoff: Record<number, WeekKey> = { 18: "wc", 19: "div", 20: "conf", 21: "probowl", 22: "sb" };
  return playoff[index] ?? null;
}

/** The calendar year of a season index (0 is the franchise's first season). */
export const seasonYear = (baseYear: number, seasonIndex: number): number => baseYear + seasonIndex;
