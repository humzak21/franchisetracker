/**
 * Editing a player's own facts (FEATURES.md 5.4): name, position, age, bio, draft slot and
 * career state, validated and merged into the stored player. Pure.
 */
import type { Position } from "../domain";
import { rangeError, type PatchResult } from "../roster/entryPatch";
import { mergeAliases, splitDisplayName } from "./identity";

type Draft<T extends string> = { year: number; round: number; pick?: number; teamId?: T };
type AgeAnchor = { age: number; year: number };

export type PlayerPatch<T extends string = string> = {
  firstName?: string;
  lastName?: string;
  /** Without first and last names they are split from it. The old name stays an alias. */
  displayName?: string;
  position?: Position;
  birthYear?: number | null;
  ageAnchor?: AgeAnchor | null;
  college?: string | null;
  heightIn?: number | null;
  weightLb?: number | null;
  draft?: Draft<T> | null;
  undrafted?: boolean;
  retired?: boolean;
};

export type PlayerFields<T extends string = string> = {
  firstName: string;
  lastName: string;
  displayName: string;
  aliases: string[];
  position: Position;
  birthYear?: number;
  ageAnchor?: AgeAnchor;
  college?: string;
  heightIn?: number;
  weightLb?: number;
  draft?: Draft<T>;
  undrafted?: boolean;
  retired: boolean;
};

export type PlayerWrite<T extends string = string> = {
  [K in keyof PlayerFields<T>]?: PlayerFields<T>[K] | undefined;
};

export const MAX_NAME = 60;

const CHECKS = [
  ["birthYear", { label: "Birth year", min: 1900, max: 2100, whole: true }],
  ["heightIn", { label: "Height", min: 48, max: 96, whole: true }],
  ["weightLb", { label: "Weight", min: 100, max: 450, whole: true }],
] as const;
const DRAFT = {
  year: { label: "Draft year", min: 1936, max: 2200, whole: true },
  round: { label: "Draft round", min: 1, max: 30, whole: true },
  pick: { label: "Draft pick", min: 1, max: 400, whole: true },
};
const ANCHOR = {
  age: { label: "Age", min: 15, max: 60, whole: true },
  year: { label: "Season", min: 1900, max: 2200, whole: true },
};

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

function names<T extends string>(
  current: PlayerFields<T>,
  patch: PlayerPatch<T>,
): PatchResult<PlayerWrite<T>> {
  if (patch.displayName === undefined && patch.firstName === undefined && patch.lastName === undefined)
    return { ok: true, fields: {} };
  const display = patch.displayName === undefined ? current.displayName : clean(patch.displayName);
  const split = splitDisplayName(display);
  const firstName = clean(
    patch.firstName ?? (patch.displayName === undefined ? current.firstName : split.firstName),
  );
  const lastName = clean(
    patch.lastName ?? (patch.displayName === undefined ? current.lastName : split.lastName),
  );
  if (!display || display.length > MAX_NAME)
    return { ok: false, error: `Names are 1 to ${MAX_NAME} characters` };
  if (!lastName || lastName.length > MAX_NAME || firstName.length > MAX_NAME)
    return { ok: false, error: `A last name is needed; names are at most ${MAX_NAME} characters` };
  const renamed = display !== current.displayName;
  return {
    ok: true,
    fields: {
      firstName,
      lastName,
      displayName: display,
      // The old name stays an alias so screenshots that still print it keep resolving.
      ...(renamed ? { aliases: mergeAliases(display, current.aliases, [current.displayName]) } : {}),
    },
  };
}

/** Merges a patch into the stored player, validating every field it sets. */
export function applyPlayerPatch<T extends string>(
  current: PlayerFields<T>,
  patch: PlayerPatch<T>,
): PatchResult<PlayerWrite<T>> {
  for (const [key, range] of CHECKS) {
    const value = patch[key];
    const error = typeof value === "number" ? rangeError(range, value) : null;
    if (error) return { ok: false, error };
  }
  const checks = [
    ...(patch.draft
      ? [
          rangeError(DRAFT.year, patch.draft.year),
          rangeError(DRAFT.round, patch.draft.round),
          patch.draft.pick === undefined ? null : rangeError(DRAFT.pick, patch.draft.pick),
        ]
      : []),
    ...(patch.ageAnchor
      ? [rangeError(ANCHOR.age, patch.ageAnchor.age), rangeError(ANCHOR.year, patch.ageAnchor.year)]
      : []),
  ];
  const error = checks.find((e) => e !== null);
  if (error) return { ok: false, error };

  const named = names(current, patch);
  if (!named.ok) return named;
  const out: PlayerWrite<T> = { ...named.fields };
  if (patch.position !== undefined) out.position = patch.position;
  if (patch.birthYear !== undefined) out.birthYear = patch.birthYear ?? undefined;
  if (patch.ageAnchor !== undefined) out.ageAnchor = patch.ageAnchor ?? undefined;
  if (patch.college !== undefined) {
    const college = clean(patch.college ?? "");
    if (college.length > MAX_NAME) return { ok: false, error: `College is at most ${MAX_NAME} characters` };
    out.college = college || undefined;
  }
  if (patch.heightIn !== undefined) out.heightIn = patch.heightIn ?? undefined;
  if (patch.weightLb !== undefined) out.weightLb = patch.weightLb ?? undefined;
  if (patch.draft !== undefined) {
    out.draft = patch.draft ?? undefined;
    // A draft slot and "undrafted" contradict each other; the slot wins unless undrafted is set too.
    if (patch.draft) out.undrafted = undefined;
  }
  if (patch.undrafted !== undefined) {
    out.undrafted = patch.undrafted || undefined;
    if (patch.undrafted) out.draft = undefined;
  }
  if (patch.retired !== undefined) out.retired = patch.retired;
  return { ok: true, fields: out };
}
