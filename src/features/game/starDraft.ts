/** The star picker's working list: shown stars in, `setStars` arguments out. */
import type { Id } from "@convex/_generated/dataModel";
import type { StarView } from "@/components/player/GameStars";

export type DraftStar = {
  /** Stable key for React while the list is reordered. */
  key: string;
  playerId: Id<"players"> | null;
  name: string;
  position: string | null;
  teamId: Id<"teams"> | null;
  caption: string;
};

export function draftFromStars(stars: readonly StarView[]): DraftStar[] {
  return stars.map((star, i) => ({
    key: star.playerId ?? `typed-${i}-${star.name}`,
    playerId: star.playerId as Id<"players"> | null,
    name: star.name,
    position: star.position,
    teamId: star.teamId as Id<"teams"> | null,
    caption: star.caption ?? "",
  }));
}

export function starsInput(draft: readonly DraftStar[]) {
  return draft.map((star) => ({
    ...(star.playerId ? { playerId: star.playerId } : { rawName: star.name }),
    ...(star.teamId ? { teamId: star.teamId } : {}),
    ...(star.caption.trim() ? { caption: star.caption.trim() } : {}),
  }));
}

/** Candidates not already picked whose name contains the search text. */
export function matching<C extends { playerId: string; name: string }>(
  candidates: readonly C[],
  draft: readonly DraftStar[],
  search: string,
): C[] {
  const picked = new Set(draft.map((s) => s.playerId));
  const text = search.trim().toLowerCase();
  return candidates.filter(
    (c) => !picked.has(c.playerId as Id<"players">) && c.name.toLowerCase().includes(text),
  );
}
