/**
 * The user team's season team stats from its regular-season games (`seasons.teamTotals`), rebuilt
 * from scratch with the season record after every game write, so running it twice changes nothing.
 * Seasons played before this existed fill in from Settings → Maintenance.
 */
import { v } from "convex/values";
import { weekPhase } from "../../shared/domain";
import { counted } from "../../shared/ops/maintenance";
import { userScore } from "../../shared/games/summary";
import { deriveTeamSeason, type TeamSeasonTotals } from "../../shared/stats/teamSeasonDerive";
import type { TeamStatLine } from "../../shared/stats/teamRegistry";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { finishRun } from "../lib/maintenanceRuns";
import { franchiseSeasonList, seasonGames } from "../lib/reports";

const MAX_FRANCHISES = 50;

export async function teamSeasonTotals(
  ctx: MutationCtx,
  season: Doc<"seasons">,
  games: readonly Doc<"games">[],
): Promise<TeamSeasonTotals> {
  const franchise = await ctx.db.get("franchises", season.franchiseId);
  const scored = games.flatMap((game) => {
    const score = userScore(game);
    // Madden's season screen ranks the regular season, so the derived figures cover only that.
    return score && weekPhase(game.weekKey) === "regular" ? [{ game, score }] : [];
  });
  const rows = await Promise.all(
    scored.map(async ({ game, score }) => {
      const sides = await ctx.db
        .query("gameTeamStats")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id))
        .take(2);
      const line = (own: boolean) => {
        const row = sides.find((s) => (s.teamId === franchise?.userTeamId) === own);
        return row ? (row.stats as TeamStatLine) : null;
      };
      return { pointsFor: score.us, pointsAgainst: score.them, own: line(true), opponent: line(false) };
    }),
  );
  return deriveTeamSeason(rows);
}

/** Every franchise, each in its own step. Returns how many were started. */
export const rebuildAll = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const franchises = await ctx.db.query("franchises").take(MAX_FRANCHISES);
    for (const franchise of franchises) {
      await ctx.scheduler.runAfter(0, internal.stats.teamTotals.rebuildFranchise, {
        franchiseId: franchise._id,
      });
    }
    return franchises.length;
  },
});

export const rebuildFranchise = internalMutation({
  args: { franchiseId: v.id("franchises") },
  returns: v.null(),
  handler: async (ctx, { franchiseId }) => {
    let seasons = 0;
    for (const season of await franchiseSeasonList(ctx, franchiseId)) {
      const games = await seasonGames(ctx, season._id);
      // Real NFL seasons before the franchise have no user games to derive from.
      if (games.length === 0) continue;
      await ctx.db.patch("seasons", season._id, { teamTotals: await teamSeasonTotals(ctx, season, games) });
      seasons++;
    }
    await finishRun(ctx, franchiseId, "teamTotals", `Recounted ${counted(seasons, "season")}`);
    return null;
  },
});
