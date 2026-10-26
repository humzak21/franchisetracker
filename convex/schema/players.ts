import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vAcquisitionType,
  vContract,
  vDevTrait,
  vPosition,
  vRosterStatus,
  vWeekKey,
} from "../lib/validators";

export const playerTables = {
  /** One entity per real person within a franchise, stable across seasons and teams. */
  players: defineTable({
    franchiseId: v.id("franchises"),
    firstName: v.string(),
    lastName: v.string(),
    displayName: v.string(),
    position: vPosition,
    birthYear: v.optional(v.number()),
    /** Used when only an age is known: the player was `age` during season `year`. */
    ageAnchor: v.optional(v.object({ age: v.number(), year: v.number() })),
    college: v.optional(v.string()),
    heightIn: v.optional(v.number()),
    weightLb: v.optional(v.number()),
    draft: v.optional(
      v.object({
        year: v.number(),
        round: v.number(),
        pick: v.optional(v.number()),
        teamId: v.optional(v.id("teams")),
      }),
    ),
    undrafted: v.optional(v.boolean()),
    isReal: v.boolean(),
    espnId: v.optional(v.number()),
    headshotStorageId: v.optional(v.id("_storage")),
    retired: v.boolean(),
    devTrait: v.optional(vDevTrait),
    abilities: v.optional(v.array(v.string())),
    /** Name variants for resolution ("D. Maye", typos); a few per player. */
    aliases: v.array(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_franchiseId_and_lastName", ["franchiseId", "lastName"])
    .index("by_franchiseId_and_displayName", ["franchiseId", "displayName"])
    .index("by_franchiseId_and_position", ["franchiseId", "position"])
    .index("by_espnId", ["espnId"])
    .searchIndex("search_displayName", { searchField: "displayName", filterFields: ["franchiseId"] }),

  /** One per season per team per player. */
  rosterEntries: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    playerId: v.id("players"),
    jersey: v.optional(v.number()),
    position: vPosition,
    depthSlot: v.optional(v.number()),
    ovr: v.optional(v.number()),
    age: v.optional(v.number()),
    exp: v.optional(v.number()),
    acquisition: v.optional(
      v.object({
        type: vAcquisitionType,
        year: v.optional(v.number()),
        detail: v.optional(v.string()),
        /** Free-text counterparts (trade partners, assets sent) as printed in the source. */
        counterparts: v.optional(v.array(v.string())),
      }),
    ),
    contract: v.optional(vContract),
    gradeNote: v.optional(v.string()),
    status: vRosterStatus,
    /** Week the status took effect (released midseason, placed on IR). */
    statusWeekKey: v.optional(vWeekKey),
    /** Other teams' rosters assembled from box scores, awards and leaders are partial. */
    partial: v.optional(v.boolean()),
  })
    .index("by_seasonId_and_teamId", ["seasonId", "teamId"])
    .index("by_playerId_and_seasonId", ["playerId", "seasonId"]),

  /** Optional mid-season OVR checkpoints for progression charts. */
  playerSnapshots: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    playerId: v.id("players"),
    weekKey: vWeekKey,
    ovr: v.number(),
  }).index("by_playerId_and_seasonId", ["playerId", "seasonId"]),
};
