/** The depth chart (FEATURES.md 5.3): a position's players in order. Pure. */
import type { Position } from "../domain";
import { positionOrder } from "../players/format";

type DepthRow = { depthSlot?: number; ovr?: number };

/** Slots first, as the roster page or the owner set them, then the best rating. */
export function byDepth(a: DepthRow, b: DepthRow): number {
  return (
    (a.depthSlot ?? Number.POSITIVE_INFINITY) - (b.depthSlot ?? Number.POSITIVE_INFINITY) ||
    (b.ovr ?? 0) - (a.ovr ?? 0)
  );
}

/** Rows by position, roster order, each position in depth order. */
export function depthChart<R>(
  rows: readonly R[],
  entryOf: (row: R) => DepthRow & { position: Position },
): { position: Position; rows: R[] }[] {
  const groups = new Map<Position, R[]>();
  for (const row of rows) {
    const position = entryOf(row).position;
    groups.set(position, [...(groups.get(position) ?? []), row]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => positionOrder(a) - positionOrder(b))
    .map(([position, group]) => ({
      position,
      rows: [...group].sort((a, b) => byDepth(entryOf(a), entryOf(b))),
    }));
}

/** The list with one id moved a place up or down; the same list when it is already at that end. */
export function moved<T>(ids: readonly T[], id: T, by: -1 | 1): T[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  next[from] = ids[to]!;
  next[to] = id;
  return next;
}
