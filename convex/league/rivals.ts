/**
 * Rivalries (FEATURES.md 5.2 head-to-head, Sprint 8): the user team's line against every
 * opponent it has met inside the franchise, from the captured games.
 */
import { v } from "convex/values";
import { rivalries } from "../../shared/games/insights";
import { query } from "../_generated/server";
import { vWlt } from "../games/validators";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { franchiseSeasonList } from "../lib/reports";
import { vGameResult, vWeekKey } from "../lib/validators";

/** Twenty seasons of full schedules, with playoffs. */
const MAX_GAMES = 600;

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      opponent: vTeamRef,
      record: vWlt,
      playoff: vWlt,
      pointsFor: v.number(),
      pointsAgainst: v.number(),
      streak: v.string(),
      last: v.object({
        year: v.number(),
        weekKey: vWeekKey,
        us: v.number(),
        them: v.number(),
        result: vGameResult,
      }),
      margins: v.array(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [games, seasons, teams] = await Promise.all([
      // Byes carry no opponent; the index's franchise prefix still reads every game.
      ctx.db
        .query("games")
        .withIndex("by_franchiseId_and_opponentTeamId", (q) => q.eq("franchiseId", franchise._id))
        .take(MAX_GAMES),
      franchiseSeasonList(ctx, franchise._id),
      teamsById(ctx),
    ]);
    const yearOf = new Map(seasons.map((s) => [s._id, s.year]));
    return rivalries(games.map((g) => ({ ...g, year: yearOf.get(g.seasonId) ?? 0 }))).flatMap(
      ({ opponentTeamId, ...line }) => {
        const team = teams.get(opponentTeamId);
        return team ? [{ opponent: toTeamRef(team), ...line }] : [];
      },
    );
  },
});
