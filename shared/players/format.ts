/** Pure display helpers for players and roster entries. */
import { ACQUISITION_LABELS, POSITIONS, type AcquisitionType, type Position } from "../domain";

export type Acquisition = { type: AcquisitionType; year?: number; detail?: string };

/** "Drafted 2024", "Free agent 2025", "Trade 2026", or null when unknown. */
export function formatAcquisition(acquisition: Acquisition | undefined | null): string | null {
  if (!acquisition) return null;
  const label = ACQUISITION_LABELS[acquisition.type];
  return acquisition.year === undefined ? label : `${label} ${acquisition.year}`;
}

type AgeSource = { birthYear?: number; ageAnchor?: { age: number; year: number } };

/** Age during a season, from a birth year or an "age N in year Y" anchor; null when unknown. */
export function ageInSeason(player: AgeSource, year: number): number | null {
  if (player.birthYear !== undefined) return year - player.birthYear;
  if (player.ageAnchor) return player.ageAnchor.age + (year - player.ageAnchor.year);
  return null;
}

/** Depth-chart order (QB first, LS last) for sorting by position. */
export function positionOrder(position: Position): number {
  return POSITIONS.indexOf(position);
}
