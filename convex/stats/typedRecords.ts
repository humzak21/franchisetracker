/**
 * Record numbers typed in by hand (FEATURES.md 5.5): the number a list cannot work out, such as a
 * career that began before 1999 (Bruce Smith, 200 sacks). Only the number, never the games.
 */
import { v } from "convex/values";
import { RECORD_STATS } from "../../shared/stats";
import type { Doc } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must, notFound } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vBoardBook, vRecordScope, vStatSplit } from "../lib/validators";
import { writePlacements } from "./boards";

const vFields = {
  book: vBoardBook,
  split: vStatSplit,
  scope: vRecordScope,
  statKey: v.string(),
  name: v.string(),
  playerId: v.optional(v.id("players")),
  teamId: v.optional(v.id("teams")),
  year: v.optional(v.number()),
  value: v.number(),
};

/** Throws on a typed record the books cannot hold. */
export function checkTypedRecord(fields: { statKey: string; name: string; value: number; year?: number }) {
  if (!(RECORD_STATS as readonly string[]).includes(fields.statKey))
    throw invalid("Pick a stat that keeps records");
  if (!fields.name.trim() || fields.name.length > 80) throw invalid("Enter the player's name");
  if (!Number.isFinite(fields.value) || fields.value <= 0) throw invalid("Enter the record number");
  if (
    fields.year !== undefined &&
    (!Number.isInteger(fields.year) || fields.year < 1920 || fields.year > 2100)
  ) {
    throw invalid("Enter a year between 1920 and 2100");
  }
}

const placements = (
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  row: Pick<Doc<"typedRecords">, "book" | "split" | "scope" | "statKey">,
) => writePlacements(ctx, franchise, row.book, { split: row.split, scope: row.scope, statKey: row.statKey });

/** Adds a typed record, or changes one. */
export const save = mutation({
  args: { typedId: v.optional(v.id("typedRecords")), ...vFields },
  returns: v.id("typedRecords"),
  handler: async (ctx, { typedId, ...fields }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    checkTypedRecord(fields);
    const row = { ...fields, name: fields.name.trim() };
    if (fields.playerId) {
      const player = must(await ctx.db.get("players", fields.playerId), "Player");
      if (player.franchiseId !== franchise._id) throw notFound("Player");
    }
    let id = typedId;
    if (id) {
      const before = await ctx.db.get("typedRecords", id);
      if (!before || before.franchiseId !== franchise._id) throw notFound("Record");
      await ctx.db.replace("typedRecords", id, { franchiseId: franchise._id, ...row });
      await placements(ctx, franchise, before);
    } else id = await ctx.db.insert("typedRecords", { franchiseId: franchise._id, ...row });
    await placements(ctx, franchise, row);
    return id;
  },
});

export const remove = mutation({
  args: { typedId: v.id("typedRecords") },
  returns: v.null(),
  handler: async (ctx, { typedId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const row = await ctx.db.get("typedRecords", typedId);
    if (!row || row.franchiseId !== franchise._id) throw notFound("Record");
    await ctx.db.delete("typedRecords", typedId);
    await placements(ctx, franchise, row);
    return null;
  },
});
