/**
 * Convex validators built from the shared domain enums. The `as const` arrays in
 * `shared/domain` are the single source of truth: adding a value there flows into
 * every schema field and function argument that uses the validator here.
 */
import { v, type VLiteral } from "convex/values";
import {
  ACQUISITION_TYPES,
  AWARD_SCOPES,
  AWARD_TYPES,
  CONFERENCES,
  DEV_TRAITS,
  DIVISIONS,
  GAME_RESULTS,
  GAME_STATUSES,
  NEED_PRIORITIES,
  PLAYOFF_RESULTS,
  PLAYOFF_ROUNDS,
  POSITION_GROUPS,
  POSITIONS,
  ROSTER_STATUSES,
  SEASON_STATUSES,
  TRANSACTION_TYPES,
  WEEK_KEYS,
} from "../../shared/domain";
import { RECONCILE_RESOLUTIONS } from "../../shared/ingestion/reconcile";
import { ESPN_LEAGUES } from "../../shared/players/espnMatch";

/** `literals(["a", "b"])` → `v.union(v.literal("a"), v.literal("b"))`, typed as `"a" | "b"`. */
export function literals<const T extends readonly [string, ...string[]]>(values: T) {
  const members = values.map((value) => v.literal(value)) as unknown as {
    -readonly [K in keyof T]: VLiteral<T[K] & string, "required">;
  };
  return v.union(...members);
}

/**
 * Backend-only enums that have no UI meaning outside Convex yet. If the front end
 * starts needing one, move it to `shared/domain` and import it here instead.
 */
export const UPLOAD_STATUSES = ["queued", "extracting", "review", "committed", "rejected", "failed"] as const;
export const UPLOAD_SOURCES = ["shortcut", "web", "dragdrop"] as const;
/** Where a season stat row came from: derived from game logs or imported season totals. */
export const STAT_SOURCES = ["logs", "import"] as const;
/** Regular season and postseason are aggregated separately (player page split toggle). */
export const STAT_SPLITS = ["regular", "postseason"] as const;
export const RECORD_SCOPES = ["game", "season", "career"] as const;
export const PROMPT_STATUSES = ["pending", "answered"] as const;
export const STANDING_SOURCES = ["import", "derived"] as const;
export const TRANSACTION_DIRECTIONS = ["in", "out"] as const;
export const MILESTONE_KINDS = [
  "career_high",
  "threshold_game",
  "first_threshold_season",
  "franchise_record",
  "streak",
  "custom",
] as const;
export const WARNING_SEVERITIES = ["info", "warning", "error"] as const;
export const IMPORT_STATUSES = ["running", "done", "failed"] as const;

// Shared domain enums.
export const vWeekKey = literals(WEEK_KEYS);
export const vPlayoffRound = literals(PLAYOFF_ROUNDS);
export const vPlayoffResult = literals(PLAYOFF_RESULTS);
export const vSeasonStatus = literals(SEASON_STATUSES);
export const vGameStatus = literals(GAME_STATUSES);
export const vGameResult = literals(GAME_RESULTS);
export const vPosition = literals(POSITIONS);
export const vPositionGroup = literals(POSITION_GROUPS);
export const vAcquisitionType = literals(ACQUISITION_TYPES);
export const vRosterStatus = literals(ROSTER_STATUSES);
export const vDevTrait = literals(DEV_TRAITS);
export const vTransactionType = literals(TRANSACTION_TYPES);
export const vNeedPriority = literals(NEED_PRIORITIES);
export const vAwardType = literals(AWARD_TYPES);
export const vAwardScope = literals(AWARD_SCOPES);
export const vConference = literals(CONFERENCES);
export const vDivision = literals(DIVISIONS);
export const vEspnLeague = literals(ESPN_LEAGUES);

// Backend-only enums.
export const vUploadStatus = literals(UPLOAD_STATUSES);
export const vUploadSource = literals(UPLOAD_SOURCES);
export const vStatSource = literals(STAT_SOURCES);
export const vStatSplit = literals(STAT_SPLITS);
export const vRecordScope = literals(RECORD_SCOPES);
export const vPromptStatus = literals(PROMPT_STATUSES);
export const vStandingSource = literals(STANDING_SOURCES);
export const vTransactionDirection = literals(TRANSACTION_DIRECTIONS);
export const vMilestoneKind = literals(MILESTONE_KINDS);
export const vWarningSeverity = literals(WARNING_SEVERITIES);
export const vImportStatus = literals(IMPORT_STATUSES);
export const vReconcileResolution = literals(RECONCILE_RESOLUTIONS);

/** Flat stat map keyed by stat-registry keys (`shared/stats/registry.ts`), e.g. `{ passYds: 203 }`. */
export const vStatMap = v.record(v.string(), v.number());

/** Win/loss/tie triple used for record caches and opponent records at kickoff. */
export const vRecord = v.object({ w: v.number(), l: v.number(), t: v.number() });

/**
 * A reference to a player that may not be resolved to an entity yet: either a
 * `playerId`, a raw name as printed on the source, or both. Spread into tables.
 */
export const playerRefFields = {
  playerId: v.optional(v.id("players")),
  rawName: v.optional(v.string()),
};
export const vPlayerRef = v.object(playerRefFields);

/** Contract terms; money in whole dollars. */
export const vContract = v.object({
  years: v.optional(v.number()),
  total: v.optional(v.number()),
  apy: v.optional(v.number()),
  guaranteed: v.optional(v.number()),
  expiresYear: v.optional(v.number()),
});

/** A draft pick as an asset (future or current) moving in a transaction. */
export const vPickAsset = v.object({
  year: v.number(),
  round: v.number(),
  originTeamId: v.optional(v.id("teams")),
  inventoryId: v.optional(v.id("draftPickInventory")),
});

/** A value an extraction produced or a user corrected it to. */
export const vScalar = v.union(v.string(), v.number(), v.boolean(), v.null());
