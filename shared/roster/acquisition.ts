import { ACQUISITION_LABELS, type AcquisitionType } from "../domain";

type DraftSlot = { year: number; round: number; pick?: number; teamId?: string };

/** Acquisitions that leave a player's own draft slot as the way he came to the team. */
const KEEPS_DRAFT: readonly AcquisitionType[] = ["draft", "resign"];

/**
 * How a roster entry came to the team, for the roster's Acquired column. A player the franchise's
 * team drafted reads as his slot ("Rd 1, Pick 1 · 2027") unless the entry records a later route
 * back (a trade, a free agent signing, a waiver claim); everyone else keeps the entry's type.
 */
export function acquisitionLabel(
  acquisition: { type: AcquisitionType } | undefined,
  draft: DraftSlot | undefined,
  userTeamId: string,
): string | null {
  const draftedHere = draft?.teamId === userTeamId;
  if (draft && draftedHere && (!acquisition || KEEPS_DRAFT.includes(acquisition.type))) {
    const pick = draft.pick === undefined ? "" : `, Pick ${draft.pick}`;
    return `Rd ${draft.round}${pick} · ${draft.year}`;
  }
  return acquisition ? ACQUISITION_LABELS[acquisition.type] : null;
}
