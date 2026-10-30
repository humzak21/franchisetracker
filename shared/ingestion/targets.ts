/**
 * The ingestion target registry (FEATURES.md principle 3): each kind of screenshot is declared
 * once. The inbox tag list, the Shortcut menu, the extraction action (schema, prompt, normalize,
 * validate) all read this. Game targets have their own drafts and editors; row targets share
 * one (`./rows`). Commit functions (`convex`) are keyed by `TargetKey` in an exhaustive record,
 * so a new target does not typecheck until it can be committed.
 */
import type { WeekKey } from "../domain/calendar";
import { lastPlayedWeek, nextWeek, type GameLike } from "../games/summary";
import { emptyHeader, emptyRowsDraft } from "./manual";
import { boxScoreSchema, teamStatsSchema, gameLogSchema, object, type JsonSchema } from "./schema";
import { normalizeBoxScore, normalizeTeamStats, normalizeGameLog, type Normalized } from "./normalize";
import { mergeRowDrafts, normalizeRows, rowProperties, rowsSchema, validateRows } from "./rows/engine";
import { gameLogPlayWarnings, toPlaysPath } from "./rows/gameLogPlays";
import { scoringPlaysSpec } from "./rows/scoringSpec";
import { ROW_TARGETS, type RowTargetDef, type RowTargetKey, type TargetScope } from "./rows/targets";
import type { RowGameContext } from "./rows/types";
import { validateBoxScore, validateTeamStats } from "./validate";
import type {
  BoxScoreDraft,
  GameLogDraft,
  GameHeader,
  Draft,
  DraftWarning,
  RowTargetDraft,
  TeamStatsDraft,
} from "./types";

export type { TargetScope } from "./rows/targets";

type GameTargetDef<D extends Draft> = {
  kind: "game";
  label: string;
  /** Where the screen's data shows up in the app, for the capture and tag pickers. */
  goesTo: string;
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
  /** The draft a manual entry starts from, for a game whose header is known so far. */
  empty: (game: GameHeader) => D;
};

const TEAM_YARDS_INSTRUCTIONS =
  "Read passing and rushing yards separately and leave total_yds null. The app calculates total yards as passing plus rushing only; never copy Madden's Total yards gained, which includes return yards.";

/** A full game log with any scoring summary in the upload read into its plays. */
function normalizeFullGameLog(raw: unknown): Normalized<GameLogDraft> {
  const log = normalizeGameLog(raw);
  const answer = typeof raw === "object" && raw !== null ? (raw as { scoring_plays?: unknown }) : {};
  const plays = normalizeRows("scoring_plays", scoringPlaysSpec, { rows: answer.scoring_plays });
  return {
    draft: { ...log.draft, plays: plays.draft.rows },
    confidence: [...log.confidence, ...plays.confidence.map((c) => ({ ...c, path: toPlaysPath(c.path) }))],
    warnings: [
      ...log.warnings,
      ...plays.warnings.map((w) => (w.path ? { ...w, path: toPlaysPath(w.path) } : w)),
    ],
  };
}

const GAME_TARGETS = {
  game_log: {
    kind: "game",
    label: "Full game log",
    goesTo: "Schedule → the game: its box score, team stats and scoring summary",
    description: "Team stats, every player's stats and the scoring summary together in one upload",
    scope: "game",
    multiImage: true,
    instructions: [
      "These are Madden post-game screenshots for one game: score summary, side-by-side team stats,",
      "player stats tabs (passing, rushing, receiving, defense, kicking, punting, returns),",
      "and possibly the scoring summary listing every score.",
      "Put each player row in its category array and each team's comparison column in teams.",
      "Use null for columns not visible and empty arrays for screens not supplied.",
      TEAM_YARDS_INSTRUCTIONS,
      "Put the scoring summary's rows in scoring_plays, an empty array if it is not supplied.",
      ROW_TARGETS.scoring_plays.instructions,
    ].join(" "),
    empty: (game) => ({
      target: "game_log",
      game,
      lines: [],
      teams: [
        { teamAbbr: game.homeAbbr, stats: {} },
        { teamAbbr: game.awayAbbr, stats: {} },
      ],
    }),
    schema: () =>
      object({
        ...gameLogSchema().properties,
        scoring_plays: {
          type: "array",
          items: object(rowProperties(scoringPlaysSpec, scoringPlaysSpec.fields())),
        },
      }),
    normalize: normalizeFullGameLog,
    validate: (draft: GameLogDraft) => [
      ...validateBoxScore({ ...draft, target: "game_box_score" }),
      ...validateTeamStats({ ...draft, target: "team_game_stats" }).filter(
        (w) => !w.path?.startsWith("game."),
      ),
    ],
  } satisfies GameTargetDef<GameLogDraft>,
  game_box_score: {
    kind: "game",
    label: "Box score",
    goesTo: "Schedule → the game's box score",
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
    empty: (game) => ({ target: "game_box_score", game, lines: [] }),
  } satisfies GameTargetDef<BoxScoreDraft>,
  team_game_stats: {
    kind: "game",
    label: "Team game stats",
    goesTo: "Schedule → the game's team stats",
    description: "First downs, yards, third downs, turnovers, penalties and possession for both teams",
    scope: "game",
    multiImage: false,
    instructions: [
      "This is the Madden post-game team stats screen comparing the two teams side by side.",
      "Return one entry in `teams` per team column.",
      TEAM_YARDS_INSTRUCTIONS,
    ].join(" "),
    schema: teamStatsSchema,
    normalize: normalizeTeamStats,
    validate: validateTeamStats,
    // One column per team, away first as the editor shows them.
    empty: (game) => ({
      target: "team_game_stats",
      game,
      teams: [game.awayAbbr, game.homeAbbr].map((teamAbbr) => ({ teamAbbr, stats: {} })),
    }),
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
  if (target === "game_log") return normalizeFullGameLog(raw);
  return target === "game_box_score" ? normalizeBoxScore(raw) : normalizeTeamStats(raw);
}

/** Row screenshots read one at a time, merged into one draft: the union of their rows. */
export function mergeFor(
  target: RowTargetKey,
  parts: readonly Normalized<RowTargetDraft>[],
): Normalized<Draft> {
  return mergeRowDrafts(ROW_TARGETS[target].spec, parts);
}

/** Runs the target's validator on a draft of any target; a game-scoped list also checks against its game. */
export function validateDraft(draft: Draft, game?: RowGameContext | null): DraftWarning[] {
  if (isRowDraft(draft)) return validateRows(ROW_TARGETS[draft.target].spec, draft, game);
  if (draft.target === "game_log") {
    return [...GAME_TARGETS.game_log.validate(draft), ...gameLogPlayWarnings(draft, game)];
  }
  return draft.target === "game_box_score" ? validateBoxScore(draft) : validateTeamStats(draft);
}

/**
 * The empty draft a manual entry of `target` starts from: no rows or lines, the game's header
 * when one is known (else the user's team at home), and team screen fields set to the user's team.
 * It names no players yet, so it is a draft of any player id type (`never`).
 */
export function emptyDraft(
  target: TargetKey,
  context: { userTeamAbbr: string | null; game: GameHeader | null },
): Draft<never> {
  if (isRowTarget(target)) return emptyRowsDraft(target, ROW_TARGETS[target].spec, context.userTeamAbbr);
  return GAME_TARGETS[target].empty(context.game ?? emptyHeader(context.userTeamAbbr));
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
