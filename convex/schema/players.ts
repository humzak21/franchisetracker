import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vAcquisitionType,
  vContract,
  vDevTrait,
  vEspnLeague,
  vPlayerOrigin,
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
    /** Worked out on creation (`shared/players/provenance.ts`); the owner can override it. */
    isReal: v.boolean(),
    /** How they entered the franchise; absent until Settings tidies a player from before it was kept. */
    origin: v.optional(vPlayerOrigin),
    /** The season they first appeared in. Imported players predate the franchise and have none. */
    createdSeasonId: v.optional(v.id("seasons")),
    /** nflverse `gsis_id` for players from the real NFL history import; the import's upsert key. */
    nflverseId: v.optional(v.string()),
    espnId: v.optional(v.number()),
    /** Where `espnId` was matched: college for prospects (the id carries into the NFL). Absent means NFL. */
    espnLeague: v.optional(vEspnLeague),
    headshotStorageId: v.optional(v.id("_storage")),
    retired: v.boolean(),
    /** Name variants for resolution ("D. Maye", typos); a few per player. */
    aliases: v.array(v.string()),
    /** `aliases` as one string for `search_aliases`; written with them (`aliasFields`). */
    aliasesText: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_franchiseId_and_lastName", ["franchiseId", "lastName"])
    .index("by_franchiseId_and_displayName", ["franchiseId", "displayName"])
    .index("by_franchiseId_and_position", ["franchiseId", "position"])
    .index("by_franchiseId_and_nflverseId", ["franchiseId", "nflverseId"])
    .index("by_espnId", ["espnId"])
    .index("by_franchiseId_and_origin", ["franchiseId", "origin"])
    .index("by_createdSeasonId", ["createdSeasonId"])
    .searchIndex("search_displayName", {
      searchField: "displayName",
      filterFields: ["franchiseId", "retired"],
    })
    .searchIndex("search_aliases", { searchField: "aliasesText", filterFields: ["franchiseId", "retired"] }),

  /** The Settings job that gives players from before provenance their origin and proper names. */
  identityTidies: defineTable({
    franchiseId: v.id("franchises"),
    status: v.union(v.literal("running"), v.literal("done")),
    checked: v.number(),
    /** Players it marked fictional, and names it repaired. */
    fictional: v.number(),
    renamed: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_franchiseId", ["franchiseId"]),

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
    /** Dev trait and abilities change season to season, so they live on the entry. */
    devTrait: v.optional(vDevTrait),
    abilities: v.optional(v.array(v.string())),
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
