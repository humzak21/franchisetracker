/**
 * What a roster entry becomes in the next season when the season advances (FEATURES.md 5.3).
 * Pure: the Convex carry-over reads and writes, this decides.
 */
import type { RosterStatus } from "../domain";

type CarriedFields = {
  status: RosterStatus;
  age?: number;
  exp?: number;
  statusWeekKey?: unknown;
};

/**
 * The next season's version of an entry, or null for a player who left during the season
 * (released or traded away). Everyone a year older and more experienced; injured reserve ends
 * with the season, while the practice squad stays where it is until a move says otherwise.
 */
export function carriedEntry<T extends CarriedFields>(entry: T): Omit<T, "statusWeekKey"> | null {
  if (entry.status === "released" || entry.status === "traded") return null;
  const { statusWeekKey: _week, ...rest } = entry;
  return {
    ...rest,
    status: entry.status === "ir" ? "active" : entry.status,
    ...(entry.age !== undefined ? { age: entry.age + 1 } : {}),
    ...(entry.exp !== undefined ? { exp: entry.exp + 1 } : {}),
  };
}
