/**
 * Typing the user team's season stats in from Stats → Team. A typed value is a `teamSeasonStats`
 * row like a captured one, so it overrides the value derived from the games; clearing it goes
 * back to the games. Any season of the franchise can be filled, real NFL history included.
 */
import { v } from "convex/values";
import { TEAM_SEASON_STAT_KEYS } from "../../shared/stats/teamSeasonRegistry";
import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { literals } from "../lib/validators";

const vStatKey = literals(TEAM_SEASON_STAT_KEYS);

/** Ranks run 1 to the league's size, with headroom for expansion. */
const MAX_RANK = 64;
/** Well past any season figure (yards per game, a turnover differential below zero). */
const MAX_VALUE = 10_000;

async function userRow(ctx: MutationCtx, seasonId: Id<"seasons">, statKey: string) {
  const franchise = await activeFranchise(ctx);
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  if (season.franchiseId !== franchise._id) throw invalid("That season belongs to another franchise");
  const row = await ctx.db
    .query("teamSeasonStats")
    .withIndex("by_seasonId_and_teamId_and_statKey", (q) =>
      q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId).eq("statKey", statKey),
    )
    .unique();
  return { franchise, row };
}

export const setSeason = mutation({
  args: {
    seasonId: v.id("seasons"),
    statKey: vStatKey,
    value: v.number(),
    rank: v.optional(v.number()),
    tied: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { seasonId, statKey, value, rank, tied }) => {
    await requireOwner(ctx);
    if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE) throw invalid("Enter a season figure");
    if (rank !== undefined && (!Number.isInteger(rank) || rank < 1 || rank > MAX_RANK)) {
      throw invalid(`A rank runs from 1 to ${MAX_RANK}`);
    }
    const { franchise, row } = await userRow(ctx, seasonId, statKey);
    const fields = { value, rank, tied: rank === undefined ? undefined : (tied ?? false) };
    if (row) await ctx.db.patch("teamSeasonStats", row._id, fields);
    else {
      await ctx.db.insert("teamSeasonStats", {
        franchiseId: franchise._id,
        seasonId,
        teamId: franchise.userTeamId,
        statKey,
        ...fields,
      });
    }
    return null;
  },
});

/** Removes a typed or captured value, so the season reads from its games again. */
export const clearSeason = mutation({
  args: { seasonId: v.id("seasons"), statKey: vStatKey },
  returns: v.null(),
  handler: async (ctx, { seasonId, statKey }) => {
    await requireOwner(ctx);
    const { row } = await userRow(ctx, seasonId, statKey);
    if (row) await ctx.db.delete("teamSeasonStats", row._id);
    return null;
  },
});
