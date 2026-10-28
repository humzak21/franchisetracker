/**
 * Assigning a season award by hand (FEATURES.md 5.8): one winner for a yearly award, replacing
 * whatever the awards screen import or the stats counted. Clearing puts the count back.
 */
import { v } from "convex/values";
import { AWARD_INFO, type AwardType } from "../../shared/domain/awards";
import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { ownSeason } from "../lib/reports";
import { vAwardType } from "../lib/validators";

/** A season's winners of one award, ties and stray duplicates included. */
const MAX_WINNERS = 20;
const MAX_STAT_LINE = 80;

function assignable(type: AwardType) {
  const { cadence } = AWARD_INFO[type];
  if (cadence !== "yearly" && cadence !== "counted") {
    throw invalid(`${AWARD_INFO[type].label} is not a one-winner season award`);
  }
}

/** Removes the season's stored winners of a yearly award; weekly and team awards are never touched. */
async function clearWinners(ctx: MutationCtx, seasonId: Id<"seasons">, type: AwardType) {
  const stored = await ctx.db
    .query("awards")
    .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", seasonId).eq("type", type))
    .take(MAX_WINNERS);
  for (const award of stored) {
    if (!award.weekKey && award.scope !== "team") await ctx.db.delete("awards", award._id);
  }
}

export const assign = mutation({
  args: {
    seasonId: v.id("seasons"),
    type: vAwardType,
    playerId: v.id("players"),
    statLine: v.optional(v.string()),
  },
  returns: v.id("awards"),
  handler: async (ctx, { seasonId, type, playerId, statLine }) => {
    await requireOwner(ctx);
    const { franchise } = await ownSeason(ctx, seasonId);
    assignable(type);
    const player = must(await ctx.db.get("players", playerId), "Player");
    if (player.franchiseId !== franchise._id) throw invalid("That player belongs to another franchise");
    const line = statLine?.trim();
    if (line && line.length > MAX_STAT_LINE)
      throw invalid(`Keep the stat line under ${MAX_STAT_LINE} characters`);
    // The team he finished the season with: roster entries are written in season order.
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
      .take(10);
    await clearWinners(ctx, seasonId, type);
    return await ctx.db.insert("awards", {
      franchiseId: franchise._id,
      seasonId,
      scope: "league",
      type,
      playerId,
      teamId: entries.at(-1)?.teamId,
      statLine: line || undefined,
    });
  },
});

export const clear = mutation({
  args: { seasonId: v.id("seasons"), type: vAwardType },
  returns: v.null(),
  handler: async (ctx, { seasonId, type }) => {
    await requireOwner(ctx);
    await ownSeason(ctx, seasonId);
    assignable(type);
    await clearWinners(ctx, seasonId, type);
    return null;
  },
});
