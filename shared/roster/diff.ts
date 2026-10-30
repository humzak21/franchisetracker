/** A roster between two seasons (FEATURES.md 5.3): who arrived, who left, whose OVR moved. Pure. */
import type { RosterStatus } from "../domain";
import { onRoster } from "./averages";

type DiffRow<P> = { playerId: P; status: RosterStatus; ovr?: number };

export type RosterDiff<R> = {
  arrivals: R[];
  departures: R[];
  /** Players on both, biggest move first; a player with no rating in either season has none. */
  changes: { before: R; after: R; delta: number }[];
};

const byOvr = <P, R extends DiffRow<P>>(a: R, b: R) => (b.ovr ?? 0) - (a.ovr ?? 0);

export function rosterDiff<P, R extends DiffRow<P>>(
  before: readonly R[],
  after: readonly R[],
): RosterDiff<R> {
  const from = new Map(before.filter((r) => onRoster(r.status)).map((r) => [r.playerId, r]));
  const to = new Map(after.filter((r) => onRoster(r.status)).map((r) => [r.playerId, r]));
  const changes: RosterDiff<R>["changes"] = [];
  for (const [playerId, row] of to) {
    const earlier = from.get(playerId);
    if (earlier?.ovr === undefined || row.ovr === undefined || earlier.ovr === row.ovr) continue;
    changes.push({ before: earlier, after: row, delta: row.ovr - earlier.ovr });
  }
  return {
    arrivals: [...to.values()].filter((r) => !from.has(r.playerId)).sort(byOvr),
    departures: [...from.values()].filter((r) => !to.has(r.playerId)).sort(byOvr),
    changes: changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
  };
}
