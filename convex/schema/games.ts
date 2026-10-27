import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  playerRefFields,
  vGameResult,
  vGameStatus,
  vPlayoffRound,
  vPosition,
  vRecord,
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
};
