/**
 * Where a player came from and whether they are a real person (FEATURES.md 5.4). Pure. By the second
 * decade a franchise is almost all created players, so realness is worked out, not assumed.
 */
import type { PlayerOrigin } from "../domain/roster";

type Identifiers = { espnId?: number; nflverseId?: string };

export type Provenance = Identifiers & {
  origin: PlayerOrigin | undefined;
  /** The season they first appeared in; null when nothing dates them. */
  createdYear: number | null;
  startYear: number;
};

/**
 * Imports and ESPN matches are real. Anyone else who first appears in the franchise's first season
 * came off a real roster; after that, a created player until matched.
 */
export function derivedIsReal({ origin, createdYear, startYear, espnId, nflverseId }: Provenance): boolean {
  if (origin === "import" || espnId !== undefined || nflverseId !== undefined) return true;
  return createdYear === null || createdYear <= startYear;
}

type Tidyable = Identifiers & { isReal: boolean };

/** What a player from before provenance was recorded gets: the facts their rows still show. */
export function tidiedProvenance(
  player: Tidyable,
  facts: { drafted: boolean; createdYear: number | null; startYear: number },
): { origin: PlayerOrigin; isReal: boolean } {
  const origin: PlayerOrigin =
    player.nflverseId !== undefined ? "import" : facts.drafted ? "draft" : "screenshot";
  // Only ever real to fictional: a player already marked fictional was marked by the owner.
  return { origin, isReal: player.isReal && derivedIsReal({ ...player, ...facts, origin }) };
}
