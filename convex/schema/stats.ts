import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  playerRefFields,
  vMilestoneKind,
  vPosition,
  vPositionGroup,
  vRecordScope,
  vStatMap,
  vStatSource,
  vStatSplit,
  vReconcileResolution,
  vWeekKey,
} from "../lib/validators";

/** Fields shared by season and career aggregates. Maps are keyed by stat-registry keys. */
const aggregateFields = {
  split: vStatSplit,
  position: v.optional(vPosition),
  positionGroup: v.optional(vPositionGroup),
  gamesPlayed: v.number(),
  gamesStarted: v.optional(v.number()),
  totals: vStatMap,
  /** Per-game averages and rates. */
  averages: v.optional(vStatMap),
  /** Counts of threshold games keyed by threshold id, e.g. `{ recYds100: 3 }`. */
  thresholdCounts: v.optional(vStatMap),
  /** Best single-game value per summed raw stat (records read these). */
  bests: v.optional(vStatMap),
};

/** A season high: the best single-game value for a stat and the game it came in. */
export const vSeasonHigh = v.object({ value: v.number(), gameId: v.id("games"), weekKey: vWeekKey });
/** Season highs keyed by stat-registry key (`shared/stats/seasonHighs.ts`). */
export const vSeasonHighs = v.record(v.string(), vSeasonHigh);

export const statTables = {
  /** Materialized per season per player per team. `source` separates log-derived and imported totals. */
  seasonPlayerStats: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    playerId: v.id("players"),
    teamId: v.id("teams"),
    source: vStatSource,
    ...aggregateFields,
    /** Best game per stat with its game, log-derived rows only. Absent until the row is recomputed. */
    bestGames: v.optional(vSeasonHighs),
  })
    .index("by_seasonId_and_positionGroup", ["seasonId", "positionGroup"])
    .index("by_seasonId_and_teamId", ["seasonId", "teamId"])
    .index("by_playerId_and_seasonId", ["playerId", "seasonId"]),

  careerPlayerStats: defineTable({
    franchiseId: v.id("franchises"),
    playerId: v.id("players"),
    seasons: v.number(),
    firstYear: v.optional(v.number()),
    lastYear: v.optional(v.number()),
    ...aggregateFields,
  })
    .index("by_playerId", ["playerId"])
    .index("by_franchiseId_and_positionGroup", ["franchiseId", "positionGroup"]),

  /**
   * Franchise records per stat, scope and split, with the top ten behind the holder (the
   * all-time leaders board). Holder fields are flattened so they can be indexed.
   */
  records: defineTable({
    franchiseId: v.id("franchises"),
    statKey: v.string(),
    scope: vRecordScope,
    split: vStatSplit,
    ...playerRefFields,
    teamId: v.optional(v.id("teams")),
    value: v.number(),
    gameId: v.optional(v.id("games")),
    seasonId: v.optional(v.id("seasons")),
    year: v.optional(v.number()),
    weekKey: v.optional(vWeekKey),
    setAt: v.optional(v.number()),
    previous: v.optional(
      v.object({
        ...playerRefFields,
        value: v.number(),
        year: v.optional(v.number()),
      }),
    ),
    top: v.array(
      v.object({ playerId: v.id("players"), value: v.number(), seasonId: v.id("seasons"), year: v.number() }),
    ),
  })
    .index("by_franchiseId_and_split_and_scope_and_statKey", ["franchiseId", "split", "scope", "statKey"])
    .index("by_playerId", ["playerId"]),

  /** Team and player streaks, current and longest, refreshed on every commit. */
  streaks: defineTable({
    franchiseId: v.id("franchises"),
    /** Absent for team streaks. */
    playerId: v.optional(v.id("players")),
    key: v.string(),
    current: v.number(),
    longest: v.number(),
  })
    .index("by_franchiseId_and_playerId", ["franchiseId", "playerId"])
    .index("by_playerId", ["playerId"]),

  milestones: defineTable({
    franchiseId: v.id("franchises"),
    /** Stable per game and player (`<kind>:<stat>`), so recommitting a game never duplicates one. */
    key: v.string(),
    seasonId: v.id("seasons"),
    weekKey: v.optional(vWeekKey),
    kind: vMilestoneKind,
    playerId: v.optional(v.id("players")),
    gameId: v.optional(v.id("games")),
    recordId: v.optional(v.id("records")),
    statKey: v.optional(v.string()),
    value: v.optional(v.number()),
    title: v.string(),
    detail: v.optional(v.string()),
    acknowledged: v.boolean(),
    acknowledgedAt: v.optional(v.number()),
    detectedAt: v.number(),
  })
    .index("by_franchiseId_and_acknowledged", ["franchiseId", "acknowledged"])
    .index("by_seasonId_and_weekKey", ["seasonId", "weekKey"])
    .index("by_gameId", ["gameId"])
    .index("by_playerId", ["playerId"]),

  /**
   * Season totals as a season stats screenshot printed them, kept beside the log-derived
   * `seasonPlayerStats` for the reconciliation view; never a source for other numbers.
   */
  reportedSeasonStats: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    playerId: v.id("players"),
    teamId: v.id("teams"),
    gamesPlayed: v.optional(v.number()),
    stats: vStatMap,
    /** Per stat key, how a difference from the logs was settled: the logs are right, or a game is missing. */
    resolved: v.optional(v.record(v.string(), vReconcileResolution)),
  })
    .index("by_seasonId_and_teamId", ["seasonId", "teamId"])
    .index("by_playerId_and_seasonId", ["playerId", "seasonId"]),
};
