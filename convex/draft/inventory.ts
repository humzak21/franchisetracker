/**
 * Pick inventory (FEATURES.md 5.9): the user team owns its own picks unless a row says it traded
 * one away, plus any picks it acquired. Rows exist only for picks that changed hands.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { franchiseSeasonList } from "../lib/reports";

const MAX_ROWS = 200;
const ROUNDS = 7;
/** Future drafts the inventory lays out. */
const YEARS_AHEAD = 3;

const vPick = v.object({
  _id: v.id("draftPickInventory"),
  year: v.number(),
  round: v.number(),
  origin: vTeamRef,
  owner: vTeamRef,
  acquiredVia: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const list = query({
  args: {},
  returns: v.object({
    years: v.array(v.number()),
    rounds: v.number(),
    acquired: v.array(vPick),
    traded: v.array(vPick),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const seasons = await franchiseSeasonList(ctx, franchise._id);
    const current =
      seasons.find((s) => s.status !== "complete")?.year ?? (seasons.at(-1)?.year ?? franchise.startYear) + 1;
    const first = current + 1;
    const [owned, owed, teams] = await Promise.all([
      ctx.db
        .query("draftPickInventory")
        .withIndex("by_franchiseId_and_ownerTeamId_and_year", (q) =>
          q.eq("franchiseId", franchise._id).eq("ownerTeamId", franchise.userTeamId).gte("year", first),
        )
        .take(MAX_ROWS),
      ctx.db
        .query("draftPickInventory")
        .withIndex("by_franchiseId_and_originTeamId_and_year", (q) =>
          q.eq("franchiseId", franchise._id).eq("originTeamId", franchise.userTeamId).gte("year", first),
        )
        .take(MAX_ROWS),
      teamsById(ctx),
    ]);
    const shape = (rows: typeof owned) =>
      rows.flatMap((r) => {
        const origin = teams.get(r.originTeamId);
        const owner = teams.get(r.ownerTeamId);
        return origin && owner && r.draftPickId === undefined
          ? [
              {
                _id: r._id,
                year: r.year,
                round: r.round,
                origin: toTeamRef(origin),
                owner: toTeamRef(owner),
                acquiredVia: r.acquiredVia,
                notes: r.notes,
              },
            ]
          : [];
      });
    const years = Array.from({ length: YEARS_AHEAD }, (_, i) => first + i);
    return {
      years,
      rounds: ROUNDS,
      acquired: shape(owned.filter((r) => r.originTeamId !== franchise.userTeamId)),
      traded: shape(owed.filter((r) => r.ownerTeamId !== franchise.userTeamId)),
    };
  },
});

/** Records a pick changing hands: one the user team acquired, or one of its own it traded away. */
export const add = mutation({
  args: {
    year: v.number(),
    round: v.number(),
    originAbbr: v.string(),
    ownerAbbr: v.string(),
    acquiredVia: v.optional(v.string()),
  },
  returns: v.id("draftPickInventory"),
  handler: async (ctx, { year, round, originAbbr, ownerAbbr, acquiredVia }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    if (!Number.isInteger(year) || year < 1970 || year > 2100) throw invalid("Pick a draft year");
    if (!Number.isInteger(round) || round < 1 || round > ROUNDS)
      throw invalid(`Rounds run from 1 to ${ROUNDS}`);
    const byAbbr = async (abbr: string) =>
      must(
        await ctx.db
          .query("teams")
          .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
          .unique(),
        `Team ${abbr}`,
      );
    const origin = await byAbbr(originAbbr);
    const owner = await byAbbr(ownerAbbr);
    if (origin._id === owner._id) throw invalid("A pick changes hands between two teams");
    if (origin._id !== franchise.userTeamId && owner._id !== franchise.userTeamId) {
      throw invalid("Only picks to or from your team are tracked");
    }
    return await ctx.db.insert("draftPickInventory", {
      franchiseId: franchise._id,
      year,
      round,
      originTeamId: origin._id,
      ownerTeamId: owner._id,
      acquiredVia: acquiredVia?.trim() || undefined,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("draftPickInventory") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("draftPickInventory", id), "Pick");
    await ctx.db.delete("draftPickInventory", id);
    return null;
  },
});
