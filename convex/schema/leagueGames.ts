import { defineTable } from "convex/server";
import { v } from "convex/values";
import { vWeekKey } from "../lib/validators";

export const leagueGameTables = {
  /**
   * Every game in the league, week by week, from the league schedule screen: who played whom
   * and the final score once played. The user team's own games also live in `games`, with the
   * box score and everything else captured about them.
   */
  leagueGames: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    weekKey: vWeekKey,
    awayTeamId: v.id("teams"),
    homeTeamId: v.id("teams"),
    awayScore: v.optional(v.number()),
    homeScore: v.optional(v.number()),
    /** Game time as printed ("Thu 8:15 PM"). */
    timeLabel: v.optional(v.string()),
  })
    .index("by_seasonId_and_weekKey", ["seasonId", "weekKey"])
    .index("by_seasonId_and_awayTeamId", ["seasonId", "awayTeamId"])
    .index("by_seasonId_and_homeTeamId", ["seasonId", "homeTeamId"]),
};
