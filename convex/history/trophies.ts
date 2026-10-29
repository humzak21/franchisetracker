import { v } from "convex/values";
import { TROPHY_KINDS } from "../../shared/history/trophies";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, MAX_SEASONS } from "../lib/franchise";
import { literals } from "../lib/validators";
import schema from "../schema";

const MAX_ENTRIES = 200;

/** Seasons (with records, coaching and notes) and real-history trophy entries for the History screen. */
export const overview = query({
  args: {},
  returns: v.object({
    startYear: v.number(),
    seasons: v.array(schema.doc("seasons")),
    entries: v.array(schema.doc("trophyEntries")),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [seasons, entries] = await Promise.all([
      ctx.db
        .query("seasons")
        .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id))
        .take(MAX_SEASONS),
      ctx.db
        .query("trophyEntries")
        .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id))
        .order("desc")
        .take(MAX_ENTRIES),
    ]);
    return { startYear: franchise.startYear, seasons, entries };
  },
});

export const addEntry = mutation({
  args: { year: v.number(), kind: literals(TROPHY_KINDS), note: v.optional(v.string()) },
  returns: v.id("trophyEntries"),
  handler: async (ctx, { year, kind, note }) => {
    await requireOwner(ctx);
    if (!Number.isInteger(year) || year < 1900 || year > 2100)
      throw invalid("Year must be between 1900 and 2100");
    const franchise = await activeFranchise(ctx);
    const trimmed = note?.trim();
    return await ctx.db.insert("trophyEntries", {
      franchiseId: franchise._id,
      year,
      kind,
      note: trimmed ? trimmed : undefined,
    });
  },
});

export const removeEntry = mutation({
  args: { entryId: v.id("trophyEntries") },
  returns: v.null(),
  handler: async (ctx, { entryId }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("trophyEntries", entryId), "Trophy entry");
    await ctx.db.delete("trophyEntries", entryId);
    return null;
  },
});
