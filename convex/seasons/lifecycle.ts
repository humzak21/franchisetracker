/**
 * Season lifecycle actions (FEATURES.md 4.1). Captured games move a season forward on their own
 * (`refreshSeasonRecord`); these are the two steps the owner takes by hand.
 */
import { v } from "convex/values";
import { finishedPlayoffResult } from "../../shared/seasons/lifecycle";
import { NEW_PROMPTS } from "../../shared/seasons/reports";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { ownSeason, seasonByYear, seasonGames } from "../lib/reports";
import { carryRostersOver } from "../players/carryOver";

/**
 * Marks the Super Bowl week done for a season the user team is out of (or that ended without a
 * captured Super Bowl). The season completes, its playoff result settles (no playoff games means
 * a missed postseason) and the post-season report becomes due. Repeating it changes nothing.
 */
export const finish = mutation({
  args: { seasonId: v.id("seasons") },
  returns: v.null(),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const { season } = await ownSeason(ctx, seasonId);
    if (season.status === "complete") return null;
    if (season.status === "upcoming") throw invalid(`The ${season.year} season has not started yet`);
    const games = await seasonGames(ctx, seasonId);
    const playoffResult = finishedPlayoffResult(games, season.userRecord?.playoffResult);
    await ctx.db.patch("seasons", seasonId, {
      status: "complete",
      userRecord: { w: 0, l: 0, t: 0, ...season.userRecord, playoffResult },
    });
    return null;
  },
});

/**
 * Starts the next season after a finished one: same staff and every team's roster to begin with,
 * no games, and a pre-season report due. Returns the existing season when it was already added.
 */
export const advance = mutation({
  args: { seasonId: v.id("seasons") },
  returns: v.id("seasons"),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const { franchise, season } = await ownSeason(ctx, seasonId);
    if (season.status !== "complete") throw invalid(`Finish the ${season.year} season first`);
    const year = season.year + 1;
    const existing = await seasonByYear(ctx, franchise._id, year);
    if (existing) return existing._id;
    const nextId = await ctx.db.insert("seasons", {
      franchiseId: franchise._id,
      year,
      status: "upcoming",
      ...(season.coaching ? { coaching: season.coaching } : {}),
    });
    await ctx.db.insert("seasonReports", {
      franchiseId: franchise._id,
      seasonId: nextId,
      prompts: NEW_PROMPTS,
      needs: [],
    });
    await carryRostersOver(ctx, franchise, season, must(await ctx.db.get("seasons", nextId), "Season"));
    return nextId;
  },
});
