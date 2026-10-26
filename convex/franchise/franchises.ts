import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import schema from "../schema";

/** Upper bound on seasons per franchise read in one query. */
const MAX_SEASONS = 100;

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
