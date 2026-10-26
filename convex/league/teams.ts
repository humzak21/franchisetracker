import { v } from "convex/values";
import { query } from "../_generated/server";
import schema from "../schema";

/** 32 teams today; headroom for expansion without becoming unbounded. */
const MAX_TEAMS = 64;

/** All teams ordered by conference, then division, then city. */
export const list = query({
  args: {},
  returns: v.array(schema.doc("teams")),
  handler: async (ctx) => {
    return await ctx.db.query("teams").withIndex("by_conference_and_division_and_city").take(MAX_TEAMS);
  },
});
