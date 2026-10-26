/**
 * The ingestion target registry (FEATURES.md principle 3): each kind of screenshot is declared
 * once. The inbox tag list, the Shortcut menu, the extraction action (schema, prompt, normalize,
 * validate) all read this. Game targets have their own drafts and editors; row targets share
 * one (`./rows`). Commit functions (`convex`) are keyed by `TargetKey` in an exhaustive record,
 * so a new target does not typecheck until it can be committed.
 */
import type { WeekKey } from "../domain/calendar";
import { lastPlayedWeek, nextWeek, type GameLike } from "../games/summary";
import { boxScoreSchema, teamStatsSchema, type JsonSchema } from "./schema";
import { normalizeBoxScore, normalizeTeamStats, type Normalized } from "./normalize";
import { mergeRowDrafts, normalizeRows, rowsSchema, validateRows } from "./rows/engine";
import { ROW_TARGETS, type RowTargetDef, type RowTargetKey, type TargetScope } from "./rows/targets";
import { validateBoxScore, validateTeamStats } from "./validate";
import type { BoxScoreDraft, Draft, DraftWarning, RowTargetDraft, TeamStatsDraft } from "./types";

export type { TargetScope } from "./rows/targets";

type GameTargetDef<D extends Draft> = {
  kind: "game";
  label: string;
  /** One line for the tag picker and the Shortcut menu. */
  description: string;
  scope: TargetScope;
  /** Several screenshots of one game are grouped into a set and extracted together. */
  multiImage: boolean;
  /** What the model is told it is looking at; appended to the shared instructions. */
  instructions: string;
  schema: () => JsonSchema;
  normalize: (raw: unknown) => Normalized<D>;
  validate: (draft: D) => DraftWarning[];
};

const GAME_TARGETS = {
  game_box_score: {
    kind: "game",
    label: "Box score",
    description:
      "Final score and every player's passing, rushing, receiving, defense, kicking and return lines",
    scope: "game",
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
  } satisfies GameTargetDef<BoxScoreDraft>,
  team_game_stats: {
    kind: "game",
    label: "Team game stats",
    description: "First downs, yards, third downs, turnovers, penalties and possession for both teams",
    scope: "game",
    multiImage: false,
    instructions: [
      "This is the Madden post-game team stats screen comparing the two teams side by side.",
      "Return one entry in `teams` per team column.",
    ].join(" "),
    schema: teamStatsSchema,
    normalize: normalizeTeamStats,
    validate: validateTeamStats,
  } satisfies GameTargetDef<TeamStatsDraft>,
} as const;

export const INGESTION_TARGETS = { ...GAME_TARGETS, ...ROW_TARGETS };

export type TargetKey = keyof typeof INGESTION_TARGETS;
export type GameTargetKey = keyof typeof GAME_TARGETS;
export type { RowTargetKey } from "./rows/targets";
export const TARGET_KEYS = Object.keys(INGESTION_TARGETS) as [TargetKey, ...TargetKey[]];

export const SCOPE_LABELS: Record<TargetScope, string> = {
  game: "One game",
  week: "One week",
  season: "The season",
};

export function isTargetKey(value: string): value is TargetKey {
  return value in INGESTION_TARGETS;
}

export function isRowTarget(key: TargetKey): key is RowTargetKey {
  return INGESTION_TARGETS[key].kind === "rows";
}

export function rowTarget(key: RowTargetKey): RowTargetDef {
  return ROW_TARGETS[key];
}

export function isRowDraft<P extends string>(draft: Draft<P>): draft is RowTargetDraft<P> {
  return isRowTarget(draft.target);
}

export function schemaFor(key: TargetKey): JsonSchema {
  return isRowTarget(key) ? rowsSchema(ROW_TARGETS[key].spec) : GAME_TARGETS[key].schema();
}

export function normalizeFor(target: TargetKey, raw: unknown): Normalized<Draft> {
  if (isRowTarget(target)) return normalizeRows(target, ROW_TARGETS[target].spec, raw);
  return target === "game_box_score" ? normalizeBoxScore(raw) : normalizeTeamStats(raw);
}

/** Row screenshots read one at a time, merged into one draft: the union of their rows. */
export function mergeFor(
  target: RowTargetKey,
  parts: readonly Normalized<RowTargetDraft>[],
): Normalized<Draft> {
  return mergeRowDrafts(ROW_TARGETS[target].spec, parts);
}

/** Runs the target's validator on a draft of any target. */
export function validateDraft(draft: Draft): DraftWarning[] {
  if (isRowDraft(draft)) return validateRows(ROW_TARGETS[draft.target].spec, draft);
  return draft.target === "game_box_score" ? validateBoxScore(draft) : validateTeamStats(draft);
}

/**
 * Context inference: the week a capture most likely belongs to when none was picked. A game
 * screen is the next game; a weekly screen (awards, injuries) the week just played; a season
 * screen has no week.
 */
export function suggestedWeek(target: TargetKey, games: readonly GameLike[]): WeekKey | null {
  const { scope } = INGESTION_TARGETS[target];
  if (scope === "season") return null;
  return scope === "week" ? (lastPlayedWeek(games) ?? nextWeek(games)) : nextWeek(games);
}
