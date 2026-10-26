import { v } from "convex/values";
import { NFL_TEAMS, USER_TEAM_ABBR } from "../../shared/domain";
import { internalMutation } from "../_generated/server";
import { must } from "../lib/errors";

const FRANCHISE_NAME = "Patriots Dynasty";
const START_YEAR = 2025;
const LAST_SEASON_YEAR = 2034;
const DEFAULT_SETTINGS = { gamesPerSeason: 17, playoffTeams: 14 };

/**
 * Idempotent initial seed: upserts the 32 teams by abbr, creates the franchise if
 * none exists, and ensures empty season shells 2025..2034 for the active franchise.
 * Run with `npx convex run franchise/seed:seedInitial`.
 */
export const seedInitial = internalMutation({
  args: {},
  returns: v.object({
    teamsInserted: v.number(),
    teamsUpdated: v.number(),
    franchiseCreated: v.boolean(),
    franchiseId: v.id("franchises"),
    seasonsInserted: v.number(),
  }),
  handler: async (ctx) => {
    let teamsInserted = 0;
    let teamsUpdated = 0;
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
        teamsInserted++;
      } else {
        // Leaves logoStorageId and aliases alone; only reference fields are refreshed.
        await ctx.db.patch("teams", existing._id, fields);
        teamsUpdated++;
      }
    }

    const userTeam = must(
      await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", USER_TEAM_ABBR))
        .unique(),
      `Team ${USER_TEAM_ABBR}`,
    );

    let franchiseCreated = false;
    let franchise = await ctx.db
      .query("franchises")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .first();
    if (franchise === null) {
      const franchiseId = await ctx.db.insert("franchises", {
        name: FRANCHISE_NAME,
        userTeamId: userTeam._id,
        startYear: START_YEAR,
        settings: DEFAULT_SETTINGS,
        isActive: true,
      });
      franchise = must(await ctx.db.get("franchises", franchiseId), "Franchise");
      franchiseCreated = true;
    }

    let seasonsInserted = 0;
    for (let year = franchise.startYear; year <= LAST_SEASON_YEAR; year++) {
      const existing = await ctx.db
        .query("seasons")
        .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id).eq("year", year))
        .unique();
      if (existing === null) {
        await ctx.db.insert("seasons", { franchiseId: franchise._id, year, status: "upcoming" });
        seasonsInserted++;
      }
    }

    return { teamsInserted, teamsUpdated, franchiseCreated, franchiseId: franchise._id, seasonsInserted };
  },
});
