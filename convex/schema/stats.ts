import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  playerRefFields,
  vMilestoneKind,
  vPosition,
  vPositionGroup,
  vBoardBook,
  vRecordBook,
  vRecordScope,
  vStatMap,
  vStatSource,
  vStatSplit,
  vReconcileResolution,
  vMarkHorizon,
  vTeamRecordScope,
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

/** Where a streak stands: a game's season and week, or a season alone. */
const vStreakPoint = v.object({
  seasonId: v.id("seasons"),
  year: v.number(),
  weekKey: v.optional(vWeekKey),
});

/** A season high: the best single-game value for a stat and the game it came in. */
export const vSeasonHigh = v.object({ value: v.number(), gameId: v.id("games"), weekKey: vWeekKey });
/** Season highs keyed by stat-registry key (`shared/stats/seasonHighs.ts`). */
export const vSeasonHighs = v.record(v.string(), vSeasonHigh);

/** A single-game entry on a list says which game; rows from before that was kept do not. */
const gameEntryFields = { gameId: v.optional(v.id("games")), weekKey: v.optional(vWeekKey) };

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
    /** Best three games per record stat, for the single-game lists. Absent until recomputed. */
    topGames: v.optional(v.record(v.string(), v.array(vSeasonHigh))),
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
    /** The team the player played the most games for; absent on rows built before it was kept. */
    teamId: v.optional(v.id("teams")),
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
      v.object({
        playerId: v.id("players"),
        value: v.number(),
        seasonId: v.id("seasons"),
        year: v.number(),
        ...gameEntryFields,
      }),
    ),
  })
    .index("by_franchiseId_and_split_and_scope_and_statKey", ["franchiseId", "split", "scope", "statKey"])
    .index("by_playerId", ["playerId"]),

  /**
   * The team and all-time records books (`shared/stats/recordBoards.ts`): the best entries of one
   * list, merged as rows arrive and rebuilt by `stats/recordBuild`. Typed entries are kept apart.
   */
  recordBoards: defineTable({
    franchiseId: v.id("franchises"),
    book: vBoardBook,
    split: vStatSplit,
    scope: vRecordScope,
    statKey: v.string(),
    top: v.array(
      v.object({
        playerId: v.id("players"),
        value: v.number(),
        year: v.number(),
        seasonId: v.optional(v.id("seasons")),
        teamId: v.optional(v.id("teams")),
        firstYear: v.optional(v.number()),
        ...gameEntryFields,
      }),
    ),
  }).index("by_franchiseId_and_book_and_split_and_scope_and_statKey", [
    "franchiseId",
    "book",
    "split",
    "scope",
    "statKey",
  ]),

  /** Record numbers typed in by hand (Bruce Smith, 200 sacks): the number, not the games behind it. */
  typedRecords: defineTable({
    franchiseId: v.id("franchises"),
    book: vBoardBook,
    split: vStatSplit,
    scope: vRecordScope,
    statKey: v.string(),
    name: v.string(),
    playerId: v.optional(v.id("players")),
    teamId: v.optional(v.id("teams")),
    year: v.optional(v.number()),
    value: v.number(),
  }).index("by_franchiseId_and_book_and_split_and_scope_and_statKey", [
    "franchiseId",
    "book",
    "split",
    "scope",
    "statKey",
  ]),

  /** Where a player stands in every records list he makes (top 20), for his page. Rewritten with the list. */
  recordPlacements: defineTable({
    franchiseId: v.id("franchises"),
    playerId: v.id("players"),
    book: vRecordBook,
    split: vStatSplit,
    scope: vRecordScope,
    statKey: v.string(),
    rank: v.number(),
    value: v.number(),
    year: v.optional(v.number()),
    firstYear: v.optional(v.number()),
    /** Single-game lists: a player can make one several times in a season. */
    weekKey: v.optional(vWeekKey),
  })
    .index("by_playerId", ["playerId"])
    .index("by_franchiseId_and_book_and_split_and_scope_and_statKey", [
      "franchiseId",
      "book",
      "split",
      "scope",
      "statKey",
    ]),

  /** The records rebuild job per franchise: which run is current and where it is. */
  recordBuilds: defineTable({
    franchiseId: v.id("franchises"),
    run: v.number(),
    status: v.union(v.literal("running"), v.literal("done")),
    phase: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_franchiseId", ["franchiseId"]),

  /**
   * The scoring records (`shared/stats/scoringBoards.ts`): the best entries of each list, worked
   * out from every scoring play of the user's team and rewritten when a game's plays change.
   */
  scoringBoards: defineTable({
    franchiseId: v.id("franchises"),
    split: vStatSplit,
    list: v.string(),
    top: v.array(
      v.object({
        value: v.number(),
        playerId: v.optional(v.id("players")),
        rawName: v.optional(v.string()),
        passerId: v.optional(v.id("players")),
        seasonId: v.id("seasons"),
        year: v.number(),
        gameId: v.optional(v.id("games")),
        weekKey: v.optional(vWeekKey),
        opponentTeamId: v.optional(v.id("teams")),
        period: v.optional(v.number()),
      }),
    ),
  }).index("by_franchiseId_and_split_and_list", ["franchiseId", "split", "list"]),

  /**
   * Every mark a player has reached, per horizon (`shared/stats/marks.ts`). Rewritten per player
   * from his log, so a correction un-reaches one too. The index reads a fastest-to list in order.
   */
  playerMarks: defineTable({
    franchiseId: v.id("franchises"),
    playerId: v.id("players"),
    statKey: v.string(),
    mark: v.number(),
    horizon: vMarkHorizon,
    gamesToReach: v.number(),
    seasonId: v.id("seasons"),
    weekKey: vWeekKey,
    gameId: v.id("games"),
  })
    .index("by_playerId", ["playerId"])
    .index("by_franchiseId_and_statKey_and_mark_and_horizon_and_gamesToReach", [
      "franchiseId",
      "statKey",
      "mark",
      "horizon",
      "gamesToReach",
    ]),

  /** The best N-game stretches per stat and window (`shared/stats/spans.ts`), merged as games arrive. */
  spanBoards: defineTable({
    franchiseId: v.id("franchises"),
    split: vStatSplit,
    statKey: v.string(),
    window: v.number(),
    top: v.array(
      v.object({
        playerId: v.id("players"),
        value: v.number(),
        startGameId: v.id("games"),
        endGameId: v.id("games"),
        startYear: v.number(),
        startWeek: vWeekKey,
        endYear: v.number(),
        endWeek: vWeekKey,
        crossesSeasons: v.boolean(),
      }),
    ),
  }).index("by_franchiseId_and_split_and_statKey_and_window", ["franchiseId", "split", "statKey", "window"]),

  /** The team's record lists (`shared/stats/teamRecords.ts`), rewritten a season at a time. */
  teamRecords: defineTable({
    franchiseId: v.id("franchises"),
    split: vStatSplit,
    scope: vTeamRecordScope,
    statKey: v.string(),
    top: v.array(
      v.object({
        value: v.number(),
        seasonId: v.id("seasons"),
        year: v.number(),
        gameId: v.optional(v.id("games")),
        weekKey: v.optional(vWeekKey),
        opponentTeamId: v.optional(v.id("teams")),
        period: v.optional(v.number()),
      }),
    ),
  }).index("by_franchiseId_and_split_and_scope_and_statKey", ["franchiseId", "split", "scope", "statKey"]),

  /** Team and player streaks, current and longest, refreshed on every commit. */
  streaks: defineTable({
    franchiseId: v.id("franchises"),
    /** Absent for team streaks. */
    playerId: v.optional(v.id("players")),
    key: v.string(),
    current: v.number(),
    longest: v.number(),
    /** Absent on rows from before dates were kept, until the next refresh or a rebuild. */
    currentFrom: v.optional(vStreakPoint),
    longestFrom: v.optional(vStreakPoint),
    longestTo: v.optional(vStreakPoint),
  })
    .index("by_franchiseId_and_playerId", ["franchiseId", "playerId"])
    .index("by_franchiseId_and_key_and_longest", ["franchiseId", "key", "longest"])
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
