import { defineTable } from "convex/server";
import { v } from "convex/values";
import { playerRefFields, vPosition } from "../lib/validators";

export const draftTables = {
  /** Picks actually made in a season's draft. */
  draftPicks: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    round: v.number(),
    overall: v.number(),
    pickInRound: v.optional(v.number()),
    teamId: v.id("teams"),
    ...playerRefFields,
    position: v.optional(vPosition),
    ovrAtDraft: v.optional(v.number()),
    college: v.optional(v.string()),
    notes: v.optional(v.string()),
    tradeNote: v.optional(v.string()),
    /** Team whose pick this originally was, when acquired by trade. */
    originTeamId: v.optional(v.id("teams")),
    /** Computed retrospectively from OVR progression, starts and awards. */
    retroGrade: v.optional(v.string()),
    retroScore: v.optional(v.number()),
  })
    .index("by_seasonId_and_overall", ["seasonId", "overall"])
    .index("by_franchiseId_and_teamId", ["franchiseId", "teamId"])
    .index("by_playerId", ["playerId"]),

  /** Future picks: owned by `ownerTeamId`, originally belonging to `originTeamId`. Keyed by year so it can run past the last season shell. */
  draftPickInventory: defineTable({
    franchiseId: v.id("franchises"),
    year: v.number(),
    round: v.number(),
    originTeamId: v.id("teams"),
    ownerTeamId: v.id("teams"),
    acquiredVia: v.optional(v.string()),
    acquiredTransactionId: v.optional(v.id("transactions")),
    /** Set once the pick is used. */
    draftPickId: v.optional(v.id("draftPicks")),
    notes: v.optional(v.string()),
  })
    .index("by_franchiseId_and_ownerTeamId_and_year", ["franchiseId", "ownerTeamId", "year"])
    .index("by_franchiseId_and_originTeamId_and_year", ["franchiseId", "originTeamId", "year"]),
};
