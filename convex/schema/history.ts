import { defineTable } from "convex/server";
import { v } from "convex/values";
import { TROPHY_KINDS } from "../../shared/history/trophies";
import { literals } from "../lib/validators";

export const historyTables = {
  /**
   * Real-history trophies from before the franchise began (or anything the owner wants on the
   * wall). Franchise-era trophies are derived from `seasons` and never stored here.
   */
  trophyEntries: defineTable({
    franchiseId: v.id("franchises"),
    year: v.number(),
    kind: literals(TROPHY_KINDS),
    note: v.optional(v.string()),
  }).index("by_franchiseId_and_year", ["franchiseId", "year"]),
};
