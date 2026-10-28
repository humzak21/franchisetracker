import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  playerRefFields,
  vConference,
  vDivision,
  vPlayoffResult,
  vStandingSource,
  vStatMap,
} from "../lib/validators";

export const leagueTables = {
  /** League-wide reference data shared by every franchise (no franchiseId). */
  teams: defineTable({
    abbr: v.string(),
    city: v.string(),
    name: v.string(),
    conference: vConference,
    division: vDivision,
    primaryColor: v.string(),
    secondaryColor: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    espnId: v.optional(v.number()),
    /** Relocations and renames, with the inclusive year range each identity applied. */
    aliases: v.optional(
      v.array(
        v.object({
          abbr: v.optional(v.string()),
          city: v.optional(v.string()),
          name: v.optional(v.string()),
          fromYear: v.optional(v.number()),
          toYear: v.optional(v.number()),
        }),
      ),
    ),
  })
    .index("by_abbr", ["abbr"])
    .index("by_conference_and_division_and_city", ["conference", "division", "city"]),

  standings: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    w: v.number(),
    l: v.number(),
    t: v.number(),
    divisionRank: v.optional(v.number()),
    seed: v.optional(v.number()),
    playoffResult: v.optional(vPlayoffResult),
    pointsFor: v.optional(v.number()),
    pointsAgainst: v.optional(v.number()),
    source: v.optional(vStandingSource),
  })
    .index("by_seasonId_and_teamId", ["seasonId", "teamId"])
    .index("by_franchiseId_and_teamId", ["franchiseId", "teamId"]),

  /** Imported top-20 rows per stat per season. */
  leagueLeaders: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    statKey: v.string(),
    rank: v.number(),
    tied: v.optional(v.boolean()),
    ...playerRefFields,
    teamId: v.optional(v.id("teams")),
    value: v.number(),
  })
    .index("by_seasonId_and_statKey_and_rank", ["seasonId", "statKey", "rank"])
    .index("by_playerId", ["playerId"]),

  /**
   * One row per season per team per stat key ("27.3 - T-3rd" → value 27.3, rank 3, tied), from
   * the team stats screen or its manual entry. For the user team a row overrides the value derived
   * from its games (`seasons.teamTotals`), and is the only source of league ranks.
   */
  teamSeasonStats: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    statKey: v.string(),
    value: v.number(),
    rank: v.optional(v.number()),
    tied: v.optional(v.boolean()),
    attempts: v.optional(v.number()),
    note: v.optional(v.string()),
  })
    .index("by_seasonId_and_teamId_and_statKey", ["seasonId", "teamId", "statKey"])
    .index("by_seasonId_and_statKey", ["seasonId", "statKey"])
    .index("by_franchiseId_and_teamId_and_statKey", ["franchiseId", "teamId", "statKey"]),

  /**
   * Every team's season numbers from Madden's league team stats screen, one row per team and
   * season. `stats` is keyed by the raw keys of `shared/stats/leagueTeamRegistry.ts`; each tab
   * captured merges into it.
   */
  leagueTeamStats: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    stats: vStatMap,
  }).index("by_seasonId_and_teamId", ["seasonId", "teamId"]),
};
