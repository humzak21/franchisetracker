/**
 * What the sample needs for the dashboard and the franchise switcher: the next game on the
 * schedule (a rematch, so it has a head-to-head), the user team's league ranks for the imported
 * season and the first franchise season, and a second, inactive franchise to switch to.
 */
import type { TeamSeasonStatKey } from "../../shared/stats/teamSeasonRegistry";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";

export const SECOND_FRANCHISE_NAME = "Sample Dynasty";

/** [stat, value and rank in the season before the franchise, then in its first season] */
const RANKS: [TeamSeasonStatKey, [number, number], [number, number]][] = [
  ["pointsPg", [24.1, 11], [28.0, 3]],
  ["yardsPg", [331.5, 15], [362.4, 6]],
  ["pointsAllowedPg", [19.8, 8], [21.6, 14]],
  ["yardsAllowedPg", [318.2, 9], [305.0, 5]],
  ["turnoverDiff", [4, 10], [6, 4]],
  ["sacks", [41, 12], [17, 7]],
];

async function teamId(ctx: MutationCtx, abbr: string): Promise<Id<"teams">> {
  const team = await ctx.db
    .query("teams")
    .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
    .unique();
  return must(team, `Team ${abbr}`)._id;
}

export async function seedSampleDashboard(
  ctx: MutationCtx,
  franchise: { _id: Id<"franchises">; userTeamId: Id<"teams"> },
  season: { _id: Id<"seasons">; year: number },
) {
  const mia = await teamId(ctx, "MIA");
  await ctx.db.insert("games", {
    franchiseId: franchise._id,
    seasonId: season._id,
    weekKey: "w7",
    homeTeamId: franchise.userTeamId,
    awayTeamId: mia,
    opponentTeamId: mia,
    userIsHome: true,
    status: "scheduled",
  });

  const before = await ctx.db
    .query("seasons")
    .withIndex("by_franchiseId_and_year", (q) =>
      q.eq("franchiseId", franchise._id).eq("year", season.year - 1),
    )
    .unique();
  for (const [statKey, previous, current] of RANKS) {
    for (const [seasonId, [value, rank]] of [
      [before?._id, previous],
      [season._id, current],
    ] as const) {
      if (!seasonId) continue;
      await ctx.db.insert("teamSeasonStats", {
        franchiseId: franchise._id,
        seasonId,
        teamId: franchise.userTeamId,
        statKey,
        value,
        rank,
      });
    }
  }

  // Inserted directly, inactive and without a history import: it only has to be there to switch to.
  const secondId = await ctx.db.insert("franchises", {
    name: SECOND_FRANCHISE_NAME,
    userTeamId: await teamId(ctx, "KC"),
    startYear: 2030,
    settings: { gamesPerSeason: 17, playoffTeams: 14 },
    isActive: false,
  });
  await ctx.db.insert("seasons", { franchiseId: secondId, year: 2030, status: "upcoming" });
}
