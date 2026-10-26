/**
 * Validators for extraction drafts, mirroring `shared/ingestion/types.ts`. Stored on
 * `extractions` and accepted by the review and commit mutations, so a malformed draft from the
 * client is refused at the boundary.
 */
import { v, type Infer } from "convex/values";
import { TARGET_KEYS } from "../../shared/ingestion/targets";
import { literals, vPosition, vStatMap, vWarningSeverity } from "./validators";

export const vTargetKey = literals(TARGET_KEYS);

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());

export const vGameHeader = v.object({
  homeAbbr: nullable(v.string()),
  awayAbbr: nullable(v.string()),
  homeScore: nullable(v.number()),
  awayScore: nullable(v.number()),
  overtime: v.boolean(),
  lineScore: nullable(v.object({ home: v.array(v.number()), away: v.array(v.number()) })),
});

const vMatch = v.object({
  status: literals(["matched", "ambiguous", "new"]),
  candidates: v.array(v.object({ playerId: v.id("players"), name: v.string(), score: v.number() })),
});

export const vDraftLine = v.object({
  id: v.string(),
  teamAbbr: nullable(v.string()),
  name: v.string(),
  position: nullable(vPosition),
  stats: vStatMap,
  playerId: nullable(v.id("players")),
  match: vMatch,
});

export const vBoxScoreDraft = v.object({
  target: v.literal("game_box_score"),
  game: vGameHeader,
  lines: v.array(vDraftLine),
});

export const vTeamStatsDraft = v.object({
  target: v.literal("team_game_stats"),
  game: vGameHeader,
  teams: v.array(v.object({ teamAbbr: nullable(v.string()), stats: vStatMap })),
});

export const vDraft = v.union(vBoxScoreDraft, vTeamStatsDraft);
export type StoredDraft = Infer<typeof vDraft>;

export const vDraftWarning = v.object({
  path: v.optional(v.string()),
  message: v.string(),
  severity: vWarningSeverity,
});

export const vFieldConfidence = v.object({ path: v.string(), value: v.number() });
