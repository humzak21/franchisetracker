import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  literals,
  vAcquisition,
  vContract,
  vPickAsset,
  vPlayerRef,
  vRosterStatus,
  vTransactionDirection,
  vTransactionPhase,
  vTransactionType,
  vWeekKey,
} from "../lib/validators";

/** The roster fields a recorded move may write (`shared/transactions/fields.ts`). */
const vRosterFields = v.object({
  status: v.optional(vRosterStatus),
  statusWeekKey: v.optional(vWeekKey),
  acquisition: v.optional(vAcquisition),
  contract: v.optional(vContract),
});

/**
 * What applying a move changed, so editing or deleting it undoes exactly that: roster entries it
 * created or changed (field by field), picks that changed hands, and players it retired.
 */
export const vMoveEffects = v.object({
  roster: v.array(
    v.object({
      entryId: v.id("rosterEntries"),
      created: v.boolean(),
      changed: v.array(literals(["status", "statusWeekKey", "acquisition", "contract"])),
      prev: vRosterFields,
      next: vRosterFields,
    }),
  ),
  picks: v.array(
    v.object({
      inventoryId: v.id("draftPickInventory"),
      created: v.boolean(),
      prevOwnerTeamId: v.optional(v.id("teams")),
      prevAcquiredVia: v.optional(v.string()),
      prevAcquiredTransactionId: v.optional(v.id("transactions")),
      nextOwnerTeamId: v.id("teams"),
    }),
  ),
  retired: v.array(v.id("players")),
});

export const transactionTables = {
  transactions: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    weekKey: v.optional(vWeekKey),
    /** When in the league year it happened; absent on older rows, read as the week's phase or "offseason". */
    phase: v.optional(vTransactionPhase),
    type: vTransactionType,
    /** The acting team; the user team unless imported from a league-wide log. */
    teamId: v.optional(v.id("teams")),
    counterpartTeamId: v.optional(v.id("teams")),
    /** Inline for rendering; mirrored into `transactionPlayers` for per-player lookups. */
    playersIn: v.array(vPlayerRef),
    playersOut: v.array(vPlayerRef),
    picksIn: v.array(vPickAsset),
    picksOut: v.array(vPickAsset),
    contract: v.optional(vContract),
    capEffect: v.optional(v.number()),
    notes: v.optional(v.string()),
    /** Trade tracker hindsight note. */
    retrospective: v.optional(v.string()),
    /** Set on moves recorded in the app, which also update rosters and picks; absent on captured ones. */
    effects: v.optional(vMoveEffects),
  })
    .index("by_seasonId_and_weekKey", ["seasonId", "weekKey"])
    .index("by_seasonId_and_type", ["seasonId", "type"]),

  /**
   * Index table: one row per resolved player in a transaction, so the player page
   * can list "transactions involving this player" with an indexed read. Written in
   * the same mutation as the transaction.
   */
  transactionPlayers: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    transactionId: v.id("transactions"),
    playerId: v.id("players"),
    direction: vTransactionDirection,
  })
    .index("by_playerId", ["playerId"])
    .index("by_transactionId", ["transactionId"]),

  injuries: defineTable({
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    weekKey: v.optional(vWeekKey),
    playerId: v.id("players"),
    teamId: v.optional(v.id("teams")),
    injuryType: v.string(),
    lengthWeeks: v.optional(v.number()),
    /** Length as printed ("3-5 weeks", "season"). */
    lengthLabel: v.optional(v.string()),
    onIr: v.boolean(),
    returnWeekKey: v.optional(vWeekKey),
    notes: v.optional(v.string()),
  })
    .index("by_seasonId_and_weekKey", ["seasonId", "weekKey"])
    .index("by_playerId", ["playerId"]),
};
