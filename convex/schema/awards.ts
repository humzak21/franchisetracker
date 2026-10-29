import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  playerRefFields,
  vAwardScope,
  vAwardType,
  vConference,
  vPosition,
  vWeekKey,
} from "../lib/validators";

export const awardTables = {
  awards: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    /** Set for weekly awards; absent for yearly awards and honors. */
    weekKey: v.optional(vWeekKey),
    scope: vAwardScope,
    type: vAwardType,
    /** Label for `type: "custom"` and user-defined team awards. */
    customName: v.optional(v.string()),
    conference: v.optional(vConference),
    /** All-Pro / Pro Bowl slot. */
    position: v.optional(vPosition),
    ...playerRefFields,
    teamId: v.optional(v.id("teams")),
    statLine: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_seasonId_and_type", ["seasonId", "type"])
    .index("by_seasonId_and_weekKey", ["seasonId", "weekKey"])
    .index("by_playerId", ["playerId"]),

  /**
   * Coaches created in this franchise for Coach of the Year: a fictional coach, or anyone the
   * bank of real head coaches (`shared/domain/coaches.ts`) does not have.
   */
  coaches: defineTable({
    franchiseId: v.id("franchises"),
    name: v.string(),
    /** `coachKey(name)`: one coach per spelling, however it is typed. */
    key: v.string(),
    teamId: v.optional(v.id("teams")),
  }).index("by_franchiseId_and_key", ["franchiseId", "key"]),
};
