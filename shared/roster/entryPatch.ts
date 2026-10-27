/**
 * Editing one season's roster entry (FEATURES.md 5.3): a flat partial patch, so a table cell can
 * save one field, merged into the stored entry with acquisition and contract kept whole. Pure.
 */
import type { AcquisitionType, DevTrait, Position, RosterStatus, WeekKey } from "../domain";

export type EntryPatch = {
  jersey?: number | null;
  position?: Position;
  ovr?: number | null;
  devTrait?: DevTrait | null;
  /** An empty list clears them. */
  abilities?: string[];
  age?: number | null;
  exp?: number | null;
  status?: RosterStatus;
  statusWeekKey?: WeekKey | null;
  acquisitionType?: AcquisitionType | null;
  acquisitionYear?: number | null;
  acquisitionDetail?: string | null;
  contractYears?: number | null;
  /** Whole dollars. */
  contractApy?: number | null;
  contractExpiresYear?: number | null;
  gradeNote?: string | null;
};

type Acquisition = { type: AcquisitionType; year?: number; detail?: string; counterparts?: string[] };
type Contract = { years?: number; total?: number; apy?: number; guaranteed?: number; expiresYear?: number };

/** The stored fields a patch can touch. */
export type EntryFields = {
  jersey?: number;
  position: Position;
  ovr?: number;
  devTrait?: DevTrait;
  abilities?: string[];
  age?: number;
  exp?: number;
  status: RosterStatus;
  statusWeekKey?: WeekKey;
  acquisition?: Acquisition;
  contract?: Contract;
  gradeNote?: string;
};

/** Fields to write; a key present with `undefined` clears that field. */
export type EntryWrite = { [K in keyof EntryFields]?: EntryFields[K] | undefined };

export type PatchResult<W> = { ok: true; fields: W } | { ok: false; error: string };

export const MAX_ABILITIES = 12;
const MAX_ABILITY_LENGTH = 40;
const MAX_DETAIL = 120;
const MAX_NOTE = 500;

type Range = { label: string; min: number; max: number; whole?: boolean };
const RANGES = {
  jersey: { label: "Jersey", min: 0, max: 99, whole: true },
  ovr: { label: "OVR", min: 0, max: 99, whole: true },
  age: { label: "Age", min: 15, max: 60, whole: true },
  exp: { label: "Experience", min: 0, max: 30, whole: true },
  acquisitionYear: { label: "Year acquired", min: 1920, max: 2200, whole: true },
  contractYears: { label: "Contract years", min: 0, max: 10, whole: true },
  contractApy: { label: "APY", min: 0, max: 1_000_000_000 },
  contractExpiresYear: { label: "Contract expiry", min: 1920, max: 2200, whole: true },
} satisfies Record<string, Range>;

/** Why a number is out of range, or null when it fits. */
export function rangeError(range: Range, value: number): string | null {
  const fits = Number.isFinite(value) && value >= range.min && value <= range.max;
  if (fits && (!range.whole || Number.isInteger(value))) return null;
  return `${range.label} must be a ${range.whole ? "whole number" : "number"} from ${range.min} to ${range.max}`;
}

/** Trimmed, unique, non-empty abilities, or an error when there are too many or one is too long. */
export function cleanAbilities(abilities: readonly string[]): PatchResult<string[]> {
  const cleaned = [...new Set(abilities.map((a) => a.trim()).filter(Boolean))];
  if (cleaned.length > MAX_ABILITIES || cleaned.some((a) => a.length > MAX_ABILITY_LENGTH))
    return { ok: false, error: `Up to ${MAX_ABILITIES} abilities of ${MAX_ABILITY_LENGTH} characters each` };
  return { ok: true, fields: cleaned };
}

const text = (value: string | null, max: number, label: string): PatchResult<string | undefined> => {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length > max) return { ok: false, error: `${label} is at most ${max} characters` };
  return { ok: true, fields: trimmed === "" ? undefined : trimmed };
};

/** Drops keys whose value is undefined; undefined itself when nothing is left. */
export function pruned<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/** Merges a patch into the stored entry, validating every field it sets. */
export function applyEntryPatch(current: EntryFields, patch: EntryPatch): PatchResult<EntryWrite> {
  for (const key of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
    const value = patch[key];
    const error = typeof value === "number" ? rangeError(RANGES[key], value) : null;
    if (error) return { ok: false, error };
  }
  const out: EntryWrite = {};
  if (patch.jersey !== undefined) out.jersey = patch.jersey ?? undefined;
  if (patch.position !== undefined) out.position = patch.position;
  if (patch.ovr !== undefined) out.ovr = patch.ovr ?? undefined;
  if (patch.devTrait !== undefined) out.devTrait = patch.devTrait ?? undefined;
  if (patch.age !== undefined) out.age = patch.age ?? undefined;
  if (patch.exp !== undefined) out.exp = patch.exp ?? undefined;
  if (patch.abilities !== undefined) {
    const abilities = cleanAbilities(patch.abilities);
    if (!abilities.ok) return abilities;
    out.abilities = abilities.fields.length > 0 ? abilities.fields : undefined;
  }
  if (patch.status !== undefined && patch.status !== current.status) {
    out.status = patch.status;
    // The week belonged to the old status ("released W5"); a new status starts without one.
    out.statusWeekKey = undefined;
  }
  if (patch.statusWeekKey !== undefined) out.statusWeekKey = patch.statusWeekKey ?? undefined;
  if (patch.gradeNote !== undefined) {
    const note = text(patch.gradeNote, MAX_NOTE, "Grade note");
    if (!note.ok) return note;
    out.gradeNote = note.fields;
  }

  const touchesAcquisition =
    patch.acquisitionType !== undefined ||
    patch.acquisitionYear !== undefined ||
    patch.acquisitionDetail !== undefined;
  if (touchesAcquisition) {
    const type = patch.acquisitionType === undefined ? current.acquisition?.type : patch.acquisitionType;
    if (type === null) out.acquisition = undefined;
    else {
      const detail =
        patch.acquisitionDetail === undefined
          ? { ok: true as const, fields: current.acquisition?.detail }
          : text(patch.acquisitionDetail, MAX_DETAIL, "Acquisition detail");
      if (!detail.ok) return detail;
      const year = patch.acquisitionYear === undefined ? current.acquisition?.year : patch.acquisitionYear;
      if (type === undefined) {
        if (year != null || detail.fields !== undefined)
          return { ok: false, error: "Pick how the player was acquired first" };
      } else {
        out.acquisition = pruned({
          ...current.acquisition,
          type,
          year: year ?? undefined,
          detail: detail.fields,
        });
      }
    }
  }

  const touchesContract =
    patch.contractYears !== undefined ||
    patch.contractApy !== undefined ||
    patch.contractExpiresYear !== undefined;
  if (touchesContract) {
    const contract = { ...current.contract };
    if (patch.contractYears !== undefined) contract.years = patch.contractYears ?? undefined;
    if (patch.contractApy !== undefined) contract.apy = patch.contractApy ?? undefined;
    if (patch.contractExpiresYear !== undefined)
      contract.expiresYear = patch.contractExpiresYear ?? undefined;
    out.contract = pruned(contract);
  }
  return { ok: true, fields: out };
}
