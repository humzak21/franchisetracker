/**
 * Brings every franchise season's worked-out team records up to date at once: for scores
 * captured before records followed them. Idempotent; run with `npx convex run league/records:refreshAll`.
 */
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { refreshLeagueRecords } from "../lib/leagueRecords";
import { franchiseSeasonList } from "../lib/reports";

const MAX_FRANCHISES = 20;

export const refreshAll = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let seasons = 0;
    for (const franchise of await ctx.db.query("franchises").take(MAX_FRANCHISES)) {
      for (const season of await franchiseSeasonList(ctx, franchise._id)) {
        if (season.year < franchise.startYear) continue;
        await refreshLeagueRecords(ctx, season._id);
        seasons++;
      }
    }
    return seasons;
  },
});
