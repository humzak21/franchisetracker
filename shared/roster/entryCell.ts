/**
 * One edited table cell to a roster entry patch. Table columns that edit an entry use the patch
 * key as their column id, so the roster and the player's roster history save the same way. Pure.
 */
import {
  ACQUISITION_TYPES,
  DEV_TRAITS,
  ROSTER_STATUSES,
  isPosition,
  isWeekKey,
  type AcquisitionType,
  type DevTrait,
  type RosterStatus,
} from "../domain";
import type { EntryPatch, PatchResult } from "./entryPatch";

type CellValue = string | number | null;

const NUMBER_FIELDS = [
  "jersey",
  "ovr",
  "age",
  "exp",
  "acquisitionYear",
  "contractYears",
  "contractExpiresYear",
] as const;
const TEXT_FIELDS = ["acquisitionDetail", "gradeNote"] as const;

const oneOf = <T extends string>(values: readonly T[], value: string): value is T =>
  (values as readonly string[]).includes(value);

/** Money cells edit in millions ("12.5"); the entry stores whole dollars. */
export const APY_UNIT = 1_000_000;

const bad = (error: string) => ({ ok: false as const, error });
const ok = (fields: EntryPatch) => ({ ok: true as const, fields });

/**
 * The patch for one cell, an error when the value does not fit the field, or null when the
 * column does not edit the entry (the player's name, the team).
 */
export function entryCellPatch(columnId: string, value: CellValue): PatchResult<EntryPatch> | null {
  if (oneOf(NUMBER_FIELDS, columnId)) {
    if (typeof value === "string") return bad("Not a valid number");
    return ok({ [columnId]: value });
  }
  if (oneOf(TEXT_FIELDS, columnId)) return ok({ [columnId]: value === null ? null : String(value) });
  if (columnId === "contractApy") {
    if (typeof value === "string") return bad("Not a valid number");
    return ok({ contractApy: value === null ? null : Math.round(value * APY_UNIT) });
  }
  if (columnId === "abilities") return ok({ abilities: value === null ? [] : String(value).split(",") });

  const choice = value === null ? null : String(value);
  switch (columnId) {
    case "position":
      return choice !== null && isPosition(choice) ? ok({ position: choice }) : bad("Pick a position");
    case "status":
      return choice !== null && oneOf<RosterStatus>(ROSTER_STATUSES, choice)
        ? ok({ status: choice })
        : bad("Pick a status");
    case "devTrait":
      return choice === null || oneOf<DevTrait>(DEV_TRAITS, choice)
        ? ok({ devTrait: choice })
        : bad("Pick a dev trait");
    case "acquisitionType":
      return choice === null || oneOf<AcquisitionType>(ACQUISITION_TYPES, choice)
        ? ok({ acquisitionType: choice })
        : bad("Pick how the player was acquired");
    case "statusWeekKey":
      return choice === null || isWeekKey(choice) ? ok({ statusWeekKey: choice }) : bad("Pick a week");
    default:
      return null;
  }
}
