/** The weekly awards batch's bookkeeping: which week each screenshot fills, what can be read or committed. Pure. */
import { REGULAR_WEEKS, weekIndex, type WeekKey } from "@shared/domain";

export type BatchSetLike = {
  setKey: string;
  status: "queued" | "extracting" | "review" | "failed" | "committed" | "rejected";
  weekKey: WeekKey | null;
  ready: boolean;
};

export type WeekState = "done" | "assigned" | "duplicate" | "missing";

/** Sets still being worked on, in upload order, then the committed ones by week. */
export function orderBatch<S extends BatchSetLike>(sets: readonly S[]): S[] {
  const open = sets.filter((s) => s.status !== "committed");
  const order = (s: BatchSetLike) => (s.weekKey ? weekIndex(s.weekKey) : 0);
  const done = sets.filter((s) => s.status === "committed").sort((a, b) => order(a) - order(b));
  return [...open, ...done];
}

/** Each regular-season week: awards stored, a screenshot waiting for it (two is a mistake), or nothing. */
export function weekStates(
  sets: readonly BatchSetLike[],
  stored: readonly WeekKey[],
): Record<WeekKey, WeekState> {
  const states = {} as Record<WeekKey, WeekState>;
  for (const week of REGULAR_WEEKS) {
    const waiting = sets.filter((s) => s.status !== "committed" && s.weekKey === week).length;
    states[week] =
      waiting > 1 ? "duplicate" : waiting === 1 ? "assigned" : stored.includes(week) ? "done" : "missing";
  }
  return states;
}

/**
 * Weeks for the screenshots without one, in upload order: each takes the next week not fully
 * captured and with no screenshot waiting, so a season uploaded in order lands W1 to W18 and a
 * second batch picks up where the first left off.
 */
export function fillWeeks(
  sets: readonly BatchSetLike[],
  complete: readonly WeekKey[],
): { setKey: string; weekKey: WeekKey }[] {
  const taken = new Set<WeekKey>([
    ...complete,
    ...sets.flatMap((s) => (s.status !== "committed" && s.weekKey ? [s.weekKey] : [])),
  ]);
  const free = REGULAR_WEEKS.filter((w) => !taken.has(w));
  return sets
    .filter((s) => s.status !== "committed" && !s.weekKey)
    .flatMap((s, i) => (free[i] ? [{ setKey: s.setKey, weekKey: free[i] }] : []));
}

/** Sets that can be read now (they have a week and are waiting or failed), and those that can commit. */
export function batchActions<S extends BatchSetLike>(sets: readonly S[]) {
  return {
    toRead: sets.filter((s) => s.weekKey && (s.status === "queued" || s.status === "failed")),
    toCommit: sets.filter((s) => s.weekKey && s.status === "review" && s.ready),
  };
}
