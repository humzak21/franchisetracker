import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { vSeasonStatus } from "../lib/validators";
import schema from "../schema";
import { deactivateAll } from "./create";

/** Upper bound on seasons per franchise read in one query. */
const MAX_SEASONS = 100;
/** One owner keeps a handful of franchises; the switcher lists them all. */
const MAX_FRANCHISES = 50;

/**
 * The active franchise with its user team and seasons (ascending by year), or
 * `null` before the seed has run.
 */
export const getActive = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      franchise: schema.doc("franchises"),
      userTeam: schema.doc("teams"),
      seasons: v.array(schema.doc("seasons")),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await ctx.db
      .query("franchises")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .first();
    if (franchise === null) return null;

    const userTeam = must(await ctx.db.get("teams", franchise.userTeamId), "User team");
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id))
      .order("asc")
      .take(MAX_SEASONS);

    return { franchise, userTeam, seasons };
  },
});

/** Every franchise for the switcher with the season it is playing, active first, then newest. */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("franchises"),
      name: v.string(),
      startYear: v.number(),
      isActive: v.boolean(),
      /** Being deleted in the background (Settings → Franchises); it can no longer be switched to. */
      deleting: v.boolean(),
      userTeam: vTeamRef,
      /** The season being played: the first not complete, else the latest. */
      current: v.union(
        v.null(),
        v.object({
          year: v.number(),
          status: vSeasonStatus,
          w: v.number(),
          l: v.number(),
          t: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchises = await ctx.db.query("franchises").order("desc").take(MAX_FRANCHISES);
    const rows = await Promise.all(
      franchises.map(async (franchise) => {
        const team = must(await ctx.db.get("teams", franchise.userTeamId), "User team");
        const seasons = await ctx.db
          .query("seasons")
          .withIndex("by_franchiseId_and_year", (q) =>
            q.eq("franchiseId", franchise._id).gte("year", franchise.startYear),
          )
          .take(MAX_SEASONS);
        // The season being played, as the app picks it: the first not complete, else the latest.
        const current = seasons.find((s) => s.status !== "complete") ?? seasons.at(-1) ?? null;
        return {
          _id: franchise._id,
          name: franchise.name,
          startYear: franchise.startYear,
          isActive: franchise.isActive,
          deleting: franchise.deletingAt !== undefined,
          userTeam: toTeamRef(team),
          current: current && {
            year: current.year,
            status: current.status,
            w: current.userRecord?.w ?? 0,
            l: current.userRecord?.l ?? 0,
            t: current.userRecord?.t ?? 0,
          },
        };
      }),
    );
    return rows.sort((a, b) => Number(b.isActive) - Number(a.isActive));
  },
});

/**
 * Makes another franchise the active one. Every screen, the inbox and the Shortcut endpoint read
 * the active franchise, so they all follow; the other franchise's data is not touched.
 */
export const activate = mutation({
  args: { franchiseId: v.id("franchises") },
  returns: v.null(),
  handler: async (ctx, { franchiseId }) => {
    await requireOwner(ctx);
    const franchise = await ctx.db.get("franchises", franchiseId);
    if (franchise === null || franchise.deletingAt !== undefined) {
      throw invalid("That franchise no longer exists");
    }
    if (franchise.isActive) return null;
    await deactivateAll(ctx);
    await ctx.db.patch("franchises", franchiseId, { isActive: true });
    return null;
  },
});
