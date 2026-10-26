/**
 * The ingestion target registry (FEATURES.md principle 3): each kind of screenshot is declared
 * once. The inbox tag list, the Shortcut menu, the extraction action (schema, prompt, normalize,
 * validate) all read this. The review form (`src`) and commit mutation (`convex`) are keyed by
 * `TargetKey` in exhaustive records, so a new target does not typecheck until both exist.
 */
import { boxScoreSchema, teamStatsSchema, type JsonSchema } from "./schema";
import { normalizeBoxScore, normalizeTeamStats, type Normalized } from "./normalize";
import { validateBoxScore, validateTeamStats } from "./validate";
import type { BoxScoreDraft, Draft, DraftWarning, TeamStatsDraft } from "./types";

type TargetDef<D extends Draft> = {
  label: string;
  /** One line for the tag picker and the Shortcut menu. */
  description: string;
  /** Several screenshots of one game are grouped into a set and extracted together. */
  multiImage: boolean;
  /** What the model is told it is looking at; appended to the shared instructions. */
  instructions: string;
  schema: () => JsonSchema;
  normalize: (raw: unknown) => Normalized<D>;
  validate: (draft: D) => DraftWarning[];
};

export const INGESTION_TARGETS = {
  game_box_score: {
    label: "Box score",
    description:
      "Final score and every player's passing, rushing, receiving, defense, kicking and return lines",
    multiImage: true,
    instructions: [
      "These are Madden post-game screens for one game: the score summary and the player stats",
      "tabs (passing, rushing, receiving, defense, kicking, punting, returns) for one or both teams.",
      "Put each player row in the array for the tab it appears on. A player who appears on several",
      "tabs gets one row in each. Use null for any column the screen does not show.",
    ].join(" "),
    schema: boxScoreSchema,
    normalize: normalizeBoxScore,
    validate: validateBoxScore,
  } satisfies TargetDef<BoxScoreDraft>,
  team_game_stats: {
    label: "Team game stats",
    description: "First downs, yards, third downs, turnovers, penalties and possession for both teams",
    multiImage: false,
    instructions: [
      "This is the Madden post-game team stats screen comparing the two teams side by side.",
      "Return one entry in `teams` per team column.",
    ].join(" "),
    schema: teamStatsSchema,
    normalize: normalizeTeamStats,
    validate: validateTeamStats,
  } satisfies TargetDef<TeamStatsDraft>,
} as const;

export type TargetKey = keyof typeof INGESTION_TARGETS;
export const TARGET_KEYS = Object.keys(INGESTION_TARGETS) as [TargetKey, ...TargetKey[]];

export function isTargetKey(value: string): value is TargetKey {
  return value in INGESTION_TARGETS;
}

/** Runs the target's validator on a draft of any target. */
export function validateDraft(draft: Draft): DraftWarning[] {
  return draft.target === "game_box_score"
    ? INGESTION_TARGETS.game_box_score.validate(draft)
    : INGESTION_TARGETS.team_game_stats.validate(draft);
}

export function normalizeFor(target: TargetKey, raw: unknown): Normalized<Draft> {
  return INGESTION_TARGETS[target].normalize(raw);
}
