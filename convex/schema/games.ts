import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  playerRefFields,
  vGameResult,
  vGameStatus,
  vPatResult,
  vPlayoffRound,
  vPosition,
  vRecord,
  vScoringKind,
  vStatMap,
  vWeekKey,
} from "../lib/validators";

export const gameTables = {
  /** User-team games, byes included as `status: "bye"` rows without an opponent. */
  games: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    weekKey: vWeekKey,
    dateLabel: v.optional(v.string()),
    homeTeamId: v.optional(v.id("teams")),
    awayTeamId: v.optional(v.id("teams")),
    /** Denormalized for head-to-head lookups. */
    opponentTeamId: v.optional(v.id("teams")),
    userIsHome: v.optional(v.boolean()),
    homeScore: v.optional(v.number()),
    awayScore: v.optional(v.number()),
    /** Points per quarter (overtime periods appended), when captured. */
    lineScore: v.optional(v.object({ home: v.array(v.number()), away: v.array(v.number()) })),
    overtime: v.optional(v.boolean()),
    result: v.optional(vGameResult),
    opponentRecord: v.optional(vRecord),
    playoffRound: v.optional(vPlayoffRound),
    stadium: v.optional(v.string()),
    neutralSite: v.optional(v.boolean()),
    weather: v.optional(v.string()),
    notes: v.optional(v.string()),
    /** Stars of the game in order, picked by hand; as many as the owner likes. */
    stars: v.optional(
      v.array(
        v.object({
          ...playerRefFields,
          teamId: v.optional(v.id("teams")),
          caption: v.optional(v.string()),
        }),
      ),
    ),
    status: vGameStatus,
  })
    .index("by_seasonId_and_weekKey", ["seasonId", "weekKey"])
    .index("by_franchiseId_and_opponentTeamId", ["franchiseId", "opponentTeamId"]),

  /** Source of truth: one row per player per game. */
  gameStatLines: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    gameId: v.id("games"),
    playerId: v.id("players"),
    teamId: v.id("teams"),
    /** Denormalized from the game for game logs and splits. */
    weekKey: vWeekKey,
    position: v.optional(vPosition),
    stats: vStatMap,
  })
    .index("by_gameId_and_teamId", ["gameId", "teamId"])
    .index("by_gameId_and_playerId", ["gameId", "playerId"])
    .index("by_playerId_and_seasonId", ["playerId", "seasonId"]),

  /** One row per game per team (first downs, total yards, TOP seconds, 3rd down made/att, ...). */
  gameTeamStats: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    gameId: v.id("games"),
    teamId: v.id("teams"),
    stats: vStatMap,
  })
    .index("by_gameId_and_teamId", ["gameId", "teamId"])
    .index("by_seasonId_and_teamId", ["seasonId", "teamId"]),

  /**
   * Every score of a game from Madden's scoring summary, rewritten as a set per game. The scorer
   * may be missing where the screen dropped the name; the score still counts.
   */
  scoringPlays: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    gameId: v.id("games"),
    /** Position in the game, 1-based. */
    order: v.number(),
    /** 1 to 4, 5 and up for overtime. */
    period: v.number(),
    /** Seconds left in the period. */
    clock: v.number(),
    teamId: v.id("teams"),
    kind: vScoringKind,
    yards: v.optional(v.number()),
    /** The scorer: `playerId` once known, `rawName` as printed. */
    ...playerRefFields,
    /** Flat rather than a nested ref, so a merge can find a player's passes by index. */
    passerId: v.optional(v.id("players")),
    passerName: v.optional(v.string()),
    pat: v.optional(vPatResult),
    homeScore: v.number(),
    awayScore: v.number(),
    /** The line as printed, for the review diff and the tooltip on the game page. */
    description: v.optional(v.string()),
  })
    .index("by_gameId_and_order", ["gameId", "order"])
    .index("by_playerId_and_seasonId", ["playerId", "seasonId"])
    .index("by_passerId", ["passerId"])
    .index("by_seasonId_and_teamId", ["seasonId", "teamId"]),
};
