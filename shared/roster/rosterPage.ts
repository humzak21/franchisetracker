/**
 * A committed roster page is the truth for its team and season (FEATURES.md 5.3): who it does not
 * list has left, and its order is the depth chart. Pure; the commit and its preview share it.
 */
import type { Position, RosterStatus } from "../domain";
import { onRoster } from "./averages";

/** Fewer rows than this is a filtered screen or a partial read, so nobody is taken off the team. */
export const MIN_WHOLE_ROSTER = 40;

export const isWholeRoster = (rows: number, partial: boolean) => !partial && rows >= MIN_WHOLE_ROSTER;

/** Entries a whole page leaves off. Madden lists the practice squad apart, so it stays put. */
export function offThePage<P, T extends { playerId: P; status: RosterStatus }>(
  entries: readonly T[],
  onPage: ReadonlySet<P>,
): T[] {
  return entries.filter(
    (e) => onRoster(e.status) && e.status !== "practice_squad" && !onPage.has(e.playerId),
  );
}

/** Each row's place at its position, in page order; a row with no position has none. */
export function depthSlots(positions: readonly (Position | null)[]): (number | undefined)[] {
  const seen = new Map<Position, number>();
  return positions.map((position) => {
    if (!position) return undefined;
    const slot = (seen.get(position) ?? 0) + 1;
    seen.set(position, slot);
    return slot;
  });
}
