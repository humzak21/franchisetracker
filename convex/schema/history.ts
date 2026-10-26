import { defineTable } from "convex/server";
import { v } from "convex/values";
import { TROPHY_KINDS } from "../../shared/history/trophies";
import { literals, vImportStatus } from "../lib/validators";

export const historyTables = {
  /**
   * Hand-added trophies from before the imported history begins (or anything the owner wants on
   * the wall). Trophies of seasons in `seasons`, imported or played, are derived, never stored here.
   */
  trophyEntries: defineTable({
    franchiseId: v.id("franchises"),
    year: v.number(),
    kind: literals(TROPHY_KINDS),
    note: v.optional(v.string()),
  }).index("by_franchiseId_and_year", ["franchiseId", "year"]),

  /**
   * The real NFL history import (docs/NFL-HISTORY.md), one per franchise. A chain of scheduled
   * steps; `run` increases on every start so a step from an older run stops instead of racing.
   */
  historyImports: defineTable({
    franchiseId: v.id("franchises"),
    run: v.number(),
    status: vImportStatus,
    /** Step keys in order ("seasons", "players", "stats:2024", ...); grows once seasons are known. */
    plan: v.array(v.string()),
    stepsDone: v.number(),
    firstYear: v.optional(v.number()),
    lastYear: v.optional(v.number()),
    counts: v.object({
      seasons: v.number(),
      players: v.number(),
      statRows: v.number(),
      draftPicks: v.number(),
      rosterEntries: v.number(),
    }),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_franchiseId", ["franchiseId"]),
};
