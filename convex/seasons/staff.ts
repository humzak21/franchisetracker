import { v } from "convex/values";
import { cleanStaff } from "../../shared/domain";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { ownSeason } from "../lib/reports";

const MAX_LENGTH = 60;
const vField = v.optional(v.string());

/** Coaching staff and schemes for one season (FEATURES.md 4.1); blank fields are cleared. */
export const update = mutation({
  args: {
    seasonId: v.id("seasons"),
    coaching: v.object({
      headCoach: vField,
      offensiveCoordinator: vField,
      defensiveCoordinator: vField,
      offensiveScheme: vField,
      defensiveScheme: vField,
    }),
  },
  returns: v.null(),
  handler: async (ctx, { seasonId, coaching }) => {
    await requireOwner(ctx);
    await ownSeason(ctx, seasonId);
    if (Object.values(coaching).some((value) => value !== undefined && value.trim().length > MAX_LENGTH)) {
      throw invalid(`Keep each name under ${MAX_LENGTH} characters`);
    }
    await ctx.db.patch("seasons", seasonId, { coaching: cleanStaff(coaching) });
    return null;
  },
});
