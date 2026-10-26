/** A player's game-by-game lines for one season, each with its game's opponent and score. */
import { v } from "convex/values";
import { sortByWeek, userScore } from "../../shared/games/summary";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { vGameResult, vStatMap, vWeekKey } from "../lib/validators";

/** A season plus playoffs, with room for a preseason. */
const MAX_LINES = 40;

export const bySeason = query({
  args: { playerId: v.id("players"), seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      gameId: v.id("games"),
      weekKey: vWeekKey,
      opponent: v.union(vTeamRef, v.null()),
      home: v.boolean(),
      result: v.union(vGameResult, v.null()),
      score: v.union(v.object({ us: v.number(), them: v.number() }), v.null()),
      stats: vStatMap,
    }),
  ),
  handler: async (ctx, { playerId, seasonId }) => {
    await requireOwner(ctx);
    const [franchise, teams] = await Promise.all([activeFranchise(ctx), teamsById(ctx)]);
    const lines = await ctx.db
      .query("gameStatLines")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
      .take(MAX_LINES);
    const rows = await Promise.all(
      sortByWeek(lines).map(async (line) => {
        const game = await ctx.db.get("games", line.gameId);
        if (!game) return null;
        // Box scores hold both teams; flip the user's point of view for an opponent's player.
        const mine = line.teamId === franchise.userTeamId;
        const forUser = userScore(game);
        const score = forUser && (mine ? forUser : { us: forUser.them, them: forUser.us });
        const opponentId = game.homeTeamId === line.teamId ? game.awayTeamId : game.homeTeamId;
        const opponent = opponentId ? teams.get(opponentId) : undefined;
        return {
          gameId: game._id,
          weekKey: line.weekKey,
          opponent: opponent ? toTeamRef(opponent) : null,
          home: game.homeTeamId === line.teamId,
          result: score ? (score.us > score.them ? "W" : score.us < score.them ? "L" : "T") : null,
          score,
          stats: line.stats,
        } as const;
      }),
    );
    return rows.filter((r) => r !== null);
  },
});
