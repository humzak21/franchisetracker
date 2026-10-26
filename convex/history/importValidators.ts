/** Argument validators for the import mutations, mirroring the parsed shapes in `shared/history`. */
import { v } from "convex/values";
import { vPlayoffResult, vPosition, vRosterStatus, vStatMap } from "../lib/validators";

const optionalNumber = v.optional(v.number());

export const vImportedStanding = v.object({
  year: v.number(),
  teamAbbr: v.string(),
  w: v.number(),
  l: v.number(),
  t: v.number(),
  divisionRank: optionalNumber,
  seed: optionalNumber,
  playoffResult: vPlayoffResult,
  pointsFor: optionalNumber,
  pointsAgainst: optionalNumber,
});

export const vImportedPlayer = v.object({
  nflverseId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  displayName: v.string(),
  position: vPosition,
  birthYear: optionalNumber,
  college: v.optional(v.string()),
  heightIn: optionalNumber,
  weightLb: optionalNumber,
  espnId: optionalNumber,
  draft: v.optional(
    v.object({ year: v.number(), round: v.number(), pick: optionalNumber, teamAbbr: v.optional(v.string()) }),
  ),
  undrafted: v.optional(v.boolean()),
  lastSeason: optionalNumber,
  /** On a roster for the franchise's first season: not retired, and may adopt a captured player. */
  active: v.boolean(),
});

export const vImportedStatRow = v.object({
  nflverseId: v.string(),
  teamAbbr: v.string(),
  position: v.union(vPosition, v.null()),
  gamesPlayed: v.number(),
  totals: vStatMap,
});

export const vImportedDraftPick = v.object({
  year: v.number(),
  round: v.number(),
  overall: v.number(),
  teamAbbr: v.string(),
  nflverseId: v.optional(v.string()),
  name: v.string(),
  position: v.optional(vPosition),
  college: v.optional(v.string()),
});

export const vImportedRosterEntry = v.object({
  nflverseId: v.string(),
  teamAbbr: v.string(),
  position: vPosition,
  jersey: optionalNumber,
  exp: optionalNumber,
  status: vRosterStatus,
  drafted: v.boolean(),
});
