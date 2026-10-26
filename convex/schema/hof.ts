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
    /** Career totals snapshot at induction, keyed by stat key. */
    careerSummary: v.optional(vStatMap),
  })
    .index("by_franchiseId_and_inductedYear", ["franchiseId", "inductedYear"])
    .index("by_playerId", ["playerId"]),
};
