/** Stars of the game, picked by hand: as many as the owner likes, in order, each with an optional caption. */
import type { Checked } from "./gameForm";

/** Far more than anyone picks; keeps the game document small. */
export const MAX_STARS = 30;
export const STAR_NAME_MAX = 60;
export const STAR_CAPTION_MAX = 120;

export type StarInput<P extends string, T extends string> = {
  playerId?: P | null;
  /** A name typed in when the player is not in the app. */
  rawName?: string | null;
  teamId?: T | null;
  caption?: string | null;
};

export type CleanStar<P extends string, T extends string> = {
  playerId?: P;
  rawName?: string;
  teamId?: T;
  caption?: string;
};

/** Trims names and captions, drops a typed name when a player is linked, and checks the limits. */
export function cleanStars<P extends string, T extends string>(
  stars: readonly StarInput<P, T>[],
): Checked<CleanStar<P, T>[]> {
  if (stars.length > MAX_STARS) return { ok: false, error: `Pick at most ${MAX_STARS} stars` };
  const out: CleanStar<P, T>[] = [];
  for (const star of stars) {
    const rawName = star.playerId ? undefined : star.rawName?.trim() || undefined;
    if (!star.playerId && !rawName) return { ok: false, error: "Each star needs a player or a name" };
    if ((rawName?.length ?? 0) > STAR_NAME_MAX) {
      return { ok: false, error: `Keep names under ${STAR_NAME_MAX} characters` };
    }
    const caption = star.caption?.trim() || undefined;
    if ((caption?.length ?? 0) > STAR_CAPTION_MAX) {
      return { ok: false, error: `Keep captions under ${STAR_CAPTION_MAX} characters` };
    }
    out.push({
      ...(star.playerId ? { playerId: star.playerId } : { rawName }),
      ...(star.teamId ? { teamId: star.teamId } : {}),
      ...(caption ? { caption } : {}),
    });
  }
  const ids = out.flatMap((s) => (s.playerId ? [s.playerId] : []));
  if (new Set(ids).size !== ids.length) return { ok: false, error: "A player can only be a star once" };
  return { ok: true, value: out };
}

/**
 * The stars with one player toggled, for the box score's one-click star: a star is taken out
 * (the rest keep their order); anyone else joins at the end. Null when the list is full.
 */
export function toggleStar<S extends { playerId?: string }>(
  stars: readonly S[],
  playerId: string,
  star: S,
): S[] | null {
  if (stars.some((s) => s.playerId === playerId)) return stars.filter((s) => s.playerId !== playerId);
  return stars.length >= MAX_STARS ? null : [...stars, star];
}

/** The list with one item moved to a new position (reordering stars). Out-of-range moves are no-ops. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
