/** What a season has captured so far: the strip on Home and Reconcile, and the checklist's facts. */
import { v } from "convex/values";
import { weekPhase, type WeekKey } from "../../shared/domain";
import { sortByWeek, userScore } from "../../shared/games/summary";
import { coverageItems, type CoverageFacts } from "../../shared/seasons/coverage";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise } from "../lib/franchise";
import { seasonGames } from "../lib/reports";

/** Every award a season hands out week by week, with headroom. */
const MAX_AWARDS = 1500;

/** The games with a result, and what each of them has. */
export async function capturedGames(ctx: QueryCtx, seasonId: Doc<"seasons">["_id"]) {
  const games = sortByWeek(await seasonGames(ctx, seasonId));
  const played = games.filter((g) => userScore(g) !== null);
  return await Promise.all(
    played.map(async (game) => {
      const [line, team, play] = await Promise.all([
        ctx.db
          .query("gameStatLines")
          .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id))
          .first(),
        ctx.db
          .query("gameTeamStats")
          .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id))
          .first(),
        ctx.db
          .query("scoringPlays")
          .withIndex("by_gameId_and_order", (q) => q.eq("gameId", game._id))
          .first(),
      ]);
      return { game, boxScore: line !== null, teamStats: team !== null, scoring: play !== null };
    }),
  );
}

/** The user team's games in the standings: a screen shot mid-season stops where it was shot. */
export async function standingsGames(ctx: QueryCtx, season: Doc<"seasons">, teamId: Doc<"teams">["_id"]) {
  const row = await ctx.db
    .query("standings")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id).eq("teamId", teamId))
    .first();
  return row ? row.w + row.l + row.t : 0;
}

/** The weeks with an award captured, and how many yearly awards, which have no week. */
export async function awardWeeks(ctx: QueryCtx, seasonId: Doc<"seasons">["_id"]) {
  const awards = await ctx.db
    .query("awards")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
    .take(MAX_AWARDS);
  return {
    weeks: [...new Set(awards.flatMap((a) => (a.weekKey ? [a.weekKey] : [])))],
    yearly: awards.filter((a) => a.weekKey === undefined).length,
  };
}

export function coverageFacts(
  captured: Awaited<ReturnType<typeof capturedGames>>,
  standings: number,
  awards: readonly WeekKey[],
): CoverageFacts {
  return {
    played: captured.length,
    boxScores: captured.filter((c) => c.boxScore).length,
    teamStats: captured.filter((c) => c.teamStats).length,
    scoringSummaries: captured.filter((c) => c.scoring).length,
    regularGames: captured.filter((c) => weekPhase(c.game.weekKey) === "regular").length,
    standingsGames: standings,
    awardWeeks: awards.filter((w) => weekPhase(w) === "regular").length,
  };
}

export const vCoverage = v.array(
  v.object({ key: v.string(), label: v.string(), have: v.number(), of: v.number() }),
);

/** Null for imported NFL seasons, which have nothing to capture. */
export const forSeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.union(v.null(), vCoverage),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id || season.year < franchise.startYear) return null;
    const [captured, standings, awards] = await Promise.all([
      capturedGames(ctx, seasonId),
      standingsGames(ctx, season, franchise.userTeamId),
      awardWeeks(ctx, seasonId),
    ]);
    return coverageItems(coverageFacts(captured, standings, awards.weeks));
  },
});
