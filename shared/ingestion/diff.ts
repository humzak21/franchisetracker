/**
 * What the user changed in review: every scalar that differs between the extracted draft and
 * the committed one. Stored as corrections and replayed as few-shot examples (FEATURES.md 5.11).
 */
import type { Draft } from "./types";

export type Scalar = string | number | boolean | null;
export type FieldChange = { path: string; from: Scalar; to: Scalar };

/** Resolution and review bookkeeping, not something the model read. */
const SKIP = new Set(["match", "playerId", "target", "accepted", "confirmedNew"]);

function flatten(value: unknown, path: string, out: Map<string, Scalar>) {
  if (value === null || typeof value !== "object") {
    out.set(path, (value ?? null) as Scalar);
    return;
  }
  if (Array.isArray(value)) {
    // Draft lines are keyed by id so a deleted line does not shift every path after it.
    value.forEach((item, i) => {
      const key = typeof item === "object" && item !== null && "id" in item ? String(item.id) : String(i);
      flatten(item, path ? `${path}.${key}` : key, out);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SKIP.has(key) || key === "id") continue;
    flatten(child, path ? `${path}.${key}` : key, out);
  }
}

export function diffDrafts(before: Draft, after: Draft): FieldChange[] {
  const a = new Map<string, Scalar>();
  const b = new Map<string, Scalar>();
  flatten(before, "", a);
  flatten(after, "", b);
  const changes: FieldChange[] = [];
  for (const path of new Set([...a.keys(), ...b.keys()])) {
    const from = a.get(path) ?? null;
    const to = b.get(path) ?? null;
    if (from !== to) changes.push({ path, from, to });
  }
  return changes;
}
