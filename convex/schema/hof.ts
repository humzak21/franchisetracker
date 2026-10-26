import { defineTable } from "convex/server";
import { v } from "convex/values";
import { vStatMap } from "../lib/validators";

export const hofTables = {
  /** A player (`playerId`) or a staff member (`staffName`). */
  hofEntries: defineTable({
    franchiseId: v.id("franchises"),
    playerId: v.optional(v.id("players")),
    staffName: v.optional(v.string()),
    /** Position for players, title for staff ("Head Coach"). */
    role: v.string(),
    teamId: v.optional(v.id("teams")),
    jersey: v.optional(v.number()),
    inductedYear: v.number(),
    retiredNumber: v.boolean(),
    blurb: v.optional(v.string()),
    firstYear: v.optional(v.number()),
    lastYear: v.optional(v.number()),
    highlightSeasons: v.optional(v.array(v.number())),
    /** Career totals with the team, keyed by stat key; refreshed whenever the entry is saved. */
    careerSummary: v.optional(vStatMap),
    careerGames: v.optional(v.number()),
  })
    .index("by_franchiseId_and_inductedYear", ["franchiseId", "inductedYear"])
    .index("by_playerId", ["playerId"]),
};
