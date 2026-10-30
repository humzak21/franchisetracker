/** The yearly retirements step (FEATURES.md 5.3): who looks done at the start of a season. Pure. */
import type { Position, RosterStatus } from "../domain";
import { onRoster } from "./averages";

/** Nobody younger is suggested. Quarterbacks and specialists last longer. */
export const MIN_RETIREMENT_AGE = 34;
const LATE_RETIREMENT_AGE = 38;
const LATE_RETIRING: readonly Position[] = ["QB", "K", "P", "LS"];

export function retirementAge(position: Position): number {
  return LATE_RETIRING.includes(position) ? LATE_RETIREMENT_AGE : MIN_RETIREMENT_AGE;
}

type Candidate = {
  position: Position;
  age: number;
  status: RosterStatus;
  retired: boolean;
  lastSeenYear?: number;
};

/** Old enough, and nothing captured this season has named them: they were only carried over. */
export function suggestsRetirement(candidate: Candidate, year: number): boolean {
  const { position, age, status, retired, lastSeenYear } = candidate;
  return !retired && onRoster(status) && age >= retirementAge(position) && (lastSeenYear ?? 0) < year;
}
