/**
 * Argument validators for the edit patches in `shared/roster/entryPatch.ts` and
 * `shared/players/playerPatch.ts`. Every field is optional; `null` clears a field.
 */
import { v, type Validator } from "convex/values";
import { vAcquisitionType, vDevTrait, vPosition, vRosterStatus, vWeekKey } from "../lib/validators";

const clearable = <T extends Validator<unknown, "required", string>>(value: T) =>
  v.optional(v.union(value, v.null()));
const number = clearable(v.number());
const text = clearable(v.string());

export const vEntryPatch = v.object({
  jersey: number,
  position: v.optional(vPosition),
  ovr: number,
  devTrait: clearable(vDevTrait),
  abilities: v.optional(v.array(v.string())),
  age: number,
  exp: number,
  status: v.optional(vRosterStatus),
  statusWeekKey: clearable(vWeekKey),
  acquisitionType: clearable(vAcquisitionType),
  acquisitionYear: number,
  acquisitionDetail: text,
  contractYears: number,
  contractApy: number,
  contractExpiresYear: number,
  gradeNote: text,
});

export const vPlayerPatch = v.object({
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  displayName: v.optional(v.string()),
  position: v.optional(vPosition),
  birthYear: number,
  ageAnchor: clearable(v.object({ age: v.number(), year: v.number() })),
  college: text,
  heightIn: number,
  weightLb: number,
  draft: clearable(
    v.object({
      year: v.number(),
      round: v.number(),
      pick: v.optional(v.number()),
      teamId: v.optional(v.id("teams")),
    }),
  ),
  undrafted: v.optional(v.boolean()),
  retired: v.optional(v.boolean()),
});
