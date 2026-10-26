import { v } from "convex/values";
import { NFL_TEAMS } from "../../shared/domain";
import { internalMutation } from "../_generated/server";

/**
 * Idempotent league seed: upserts the 32 teams by abbreviation. Franchises are created by
 * the owner through setup (`franchise/setup:create`), never seeded.
 * Run with `npm run seed` (`npx convex run league/seed:seedTeams`).
 */
export const seedTeams = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    for (const seed of NFL_TEAMS) {
      const fields = {
        abbr: seed.abbr,
        city: seed.city,
        name: seed.name,
        conference: seed.conference,
        division: seed.division,
        primaryColor: seed.primaryColor,
        secondaryColor: seed.secondaryColor,
        espnId: seed.espnId,
      };
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", seed.abbr))
        .unique();
      if (existing === null) {
        await ctx.db.insert("teams", fields);
        inserted++;
      } else {
        // Leaves logoStorageId and aliases alone; only reference fields are refreshed.
        await ctx.db.patch("teams", existing._id, fields);
        updated++;
      }
    }
    return { inserted, updated };
  },
});
