/** Every franchise game in a compact form, for the command palette's game search (FEATURES.md 5.14). */
import { v } from "convex/values";
import { weekIndex } from "../../shared/domain";
import { resultOf, userScore } from "../../shared/games/summary";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { franchiseSeasonList } from "../lib/reports";
import { vGameResult, vWeekKey } from "../lib/validators";

/** Twenty seasons of full schedules, with playoffs. */
const MAX_GAMES = 600;

export const all = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("games"),
      year: v.number(),
      weekKey: vWeekKey,
      opponentAbbr: v.string(),
      opponentName: v.string(),
      userIsHome: v.union(v.boolean(), v.null()),
      us: v.union(v.number(), v.null()),
      them: v.union(v.number(), v.null()),
      result: v.union(vGameResult, v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [games, seasons, teams] = await Promise.all([
      ctx.db
        .query("games")
        .withIndex("by_franchiseId_and_opponentTeamId", (q) => q.eq("franchiseId", franchise._id))
        .take(MAX_GAMES),
      franchiseSeasonList(ctx, franchise._id),
      teamsById(ctx),
    ]);
    const yearOf = new Map(seasons.map((s) => [s._id, s.year]));
    return games
      .flatMap((game) => {
        const opponent = game.opponentTeamId ? teams.get(game.opponentTeamId) : undefined;
        if (!opponent) return [];
        const score = userScore(game);
        return [
          {
            _id: game._id,
            year: yearOf.get(game.seasonId) ?? 0,
            weekKey: game.weekKey,
            opponentAbbr: opponent.abbr,
            opponentName: `${opponent.city} ${opponent.name}`,
            userIsHome: game.userIsHome ?? null,
            us: score?.us ?? null,
            them: score?.them ?? null,
            result: resultOf(game),
          },
        ];
      })
      .sort((a, b) => b.year - a.year || weekIndex(b.weekKey) - weekIndex(a.weekKey));
  },
});
