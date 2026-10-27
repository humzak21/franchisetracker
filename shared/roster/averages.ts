/** Roster averages (age, OVR, experience) for the team and each side of the ball. Pure. */
import { SIDES, sideOf, type Position, type RosterStatus, type Side } from "../domain";

export type AverageRow = {
  position: Position;
  status: RosterStatus;
  age: number | null | undefined;
  ovr: number | null | undefined;
  exp: number | null | undefined;
};

export type Averages = {
  /** Players counted (on the roster), whether or not each value is known. */
  count: number;
  age: number | null;
  ovr: number | null;
  exp: number | null;
};

export type RosterAverages = Record<"team" | Side, Averages>;

/** Released and traded players have left the team, so they never count toward its averages. */
export function onRoster(status: RosterStatus): boolean {
  return status !== "released" && status !== "traded";
}

/** Mean of the known values, rounded to one decimal; null when none are known. */
export function mean(values: readonly (number | null | undefined)[]): number | null {
  const known = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (known.length === 0) return null;
  return Math.round((known.reduce((sum, v) => sum + v, 0) / known.length) * 10) / 10;
}

function averagesOf(rows: readonly AverageRow[]): Averages {
  return {
    count: rows.length,
    age: mean(rows.map((r) => r.age)),
    ovr: mean(rows.map((r) => r.ovr)),
    exp: mean(rows.map((r) => r.exp)),
  };
}

/** Averages for the whole roster and for offense, defense and special teams; skips missing values. */
export function rosterAverages(rows: readonly AverageRow[]): RosterAverages {
  const counted = rows.filter((r) => onRoster(r.status));
  const bySide = Object.fromEntries(
    SIDES.map((side) => [side, averagesOf(counted.filter((r) => sideOf(r.position) === side))]),
  ) as Record<Side, Averages>;
  return { team: averagesOf(counted), ...bySide };
}
