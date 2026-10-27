import { defineTable } from "convex/server";
import { v } from "convex/values";
import { vGoalOutcome, vGoalScope, vGoalType } from "../lib/validators";

export const goalTables = {
  /** Pre-season goals for a season (`shared/domain/goals.ts`), in the order the owner set. */
  seasonGoals: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    scope: vGoalScope,
    type: vGoalType,
    /** Player goals only. */
    playerId: v.optional(v.id("players")),
    /** `stat` goals: a stat-registry key. */
    statKey: v.optional(v.string()),
    /** Wins for `wins`, the stat value for `stat`. */
    target: v.optional(v.number()),
    /** The write-in text, or a note on any goal. */
    text: v.optional(v.string()),
    /** Set by hand: write-ins always, any goal to override what the numbers say. */
    outcome: v.optional(vGoalOutcome),
    order: v.number(),
  }).index("by_seasonId_and_order", ["seasonId", "order"]),
};
