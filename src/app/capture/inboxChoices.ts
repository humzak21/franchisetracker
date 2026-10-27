/** Which inbox sets the game import sheet offers, in what order. */

type InboxSetLike = { status: string; targetKey: string | null; createdAt: number };

/** Committed sets are written already and extracting ones are busy; neither can be retagged. */
const LOCKED = new Set(["committed", "extracting"]);

/** Sets that can still be attached to a game: untagged ones first, then newest first. */
export function attachableSets<S extends InboxSetLike>(sets: readonly S[]): S[] {
  return sets
    .filter((s) => !LOCKED.has(s.status))
    .sort((a, b) => Number(a.targetKey !== null) - Number(b.targetKey !== null) || b.createdAt - a.createdAt);
}
