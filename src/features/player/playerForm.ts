/** The player Edit sheet's text fields to and from the player patch. Pure. */
import type { Position } from "@shared/domain";
import { ageInSeason } from "@shared/players/format";
import type { PlayerPatch } from "@shared/players/playerPatch";
import type { PatchResult } from "@shared/roster/entryPatch";

export type PlayerForm = {
  firstName: string;
  lastName: string;
  displayName: string;
  position: Position;
  birthYear: string;
  /** Used only without a birth year: his age in the anchor season. */
  age: string;
  college: string;
  feet: string;
  inches: string;
  weight: string;
  draftYear: string;
  draftRound: string;
  draftPick: string;
  draftTeamId: string;
  undrafted: boolean;
  retired: boolean;
};

type PlayerLike<T extends string> = {
  firstName: string;
  lastName: string;
  displayName: string;
  position: Position;
  birthYear?: number;
  ageAnchor?: { age: number; year: number };
  college?: string;
  heightIn?: number;
  weightLb?: number;
  draft?: { year: number; round: number; pick?: number; teamId?: T };
  undrafted?: boolean;
  retired: boolean;
};

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function formFromPlayer<T extends string>(player: PlayerLike<T>, anchorYear: number): PlayerForm {
  const height = player.heightIn;
  return {
    firstName: player.firstName,
    lastName: player.lastName,
    displayName: player.displayName,
    position: player.position,
    birthYear: str(player.birthYear),
    age: player.birthYear === undefined ? str(ageInSeason(player, anchorYear)) : "",
    college: player.college ?? "",
    feet: height ? str(Math.floor(height / 12)) : "",
    inches: height ? str(height % 12) : "",
    weight: str(player.weightLb),
    draftYear: str(player.draft?.year),
    draftRound: str(player.draft?.round),
    draftPick: str(player.draft?.pick),
    draftTeamId: player.draft?.teamId ?? "",
    undrafted: player.undrafted ?? false,
    retired: player.retired,
  };
}

/**
 * The patch the form describes; the server validates ranges. Names go only when edited, so a new
 * display name alone re-splits into first and last. `anchorYear` dates a typed age.
 */
export function patchFromForm<T extends string>(
  form: PlayerForm,
  original: PlayerForm,
  anchorYear: number,
): PatchResult<PlayerPatch<T>> {
  const birthYear = num(form.birthYear);
  const age = num(form.age);
  const feet = num(form.feet);
  const inches = num(form.inches);
  const [year, round, pick] = [num(form.draftYear), num(form.draftRound), num(form.draftPick)];
  const anyDraft = year !== null || round !== null || pick !== null || form.draftTeamId !== "";
  if (!form.undrafted && anyDraft && (year === null || round === null))
    return { ok: false, error: "A draft slot needs a year and a round" };
  return {
    ok: true,
    fields: {
      ...(form.firstName !== original.firstName ? { firstName: form.firstName } : {}),
      ...(form.lastName !== original.lastName ? { lastName: form.lastName } : {}),
      ...(form.displayName !== original.displayName ? { displayName: form.displayName } : {}),
      position: form.position,
      birthYear,
      ...(birthYear === null ? { ageAnchor: age === null ? null : { age, year: anchorYear } } : {}),
      college: form.college,
      heightIn: feet === null && inches === null ? null : (feet ?? 0) * 12 + (inches ?? 0),
      weightLb: num(form.weight),
      draft:
        form.undrafted || year === null || round === null
          ? null
          : {
              year,
              round,
              ...(pick === null ? {} : { pick }),
              ...(form.draftTeamId ? { teamId: form.draftTeamId as T } : {}),
            },
      undrafted: form.undrafted,
      retired: form.retired,
    },
  };
}
