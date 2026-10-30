import { v } from "convex/values";
import {
  record,
  recordBefore,
  resultOf,
  seasonSummary,
  sortByWeek,
  userScore,
} from "../../shared/games/summary";
import { lineScoreError } from "../../shared/games/lineScore";
import type { Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { ownGame } from "./access";
import { gamePlays, quartersFromPlays } from "./playRows";
import { activeFranchise, teamsById, MAX_SEASONS } from "../lib/franchise";
import {
  vGameRow,
  vLineScore,
  vHeadToHeadGame,
  vSeasonSummary,
  vStarView,
  vWeekPoint,
  vWlt,
} from "./validators";
import { gameRow, loadStarPlayers, starViews, weekPointRows } from "./views";
import schema from "../schema";

/** Preseason, 18 weeks, four playoff rounds, Pro Bowl: well under this. */
const MAX_GAMES_PER_SEASON = 40;
/** Every meeting with one opponent across the franchise's lifetime. */
const MAX_HEAD_TO_HEAD = 100;

async function seasonGames(ctx: QueryCtx, seasonId: Id<"seasons">) {
  const games = await ctx.db
    .query("games")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
    .take(MAX_GAMES_PER_SEASON);
  return sortByWeek(games);
}

/** The season's schedule in calendar order, with opponents and stars resolved, a summary and the chart points. */
export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({ games: v.array(vGameRow), summary: vSeasonSummary, points: v.array(vWeekPoint) }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const games = await seasonGames(ctx, seasonId);
    const [teams, players] = await Promise.all([teamsById(ctx), loadStarPlayers(ctx, games)]);
    return {
      games: games.map((game) => gameRow(game, teams, players)),
      summary: seasonSummary(games),
      points: weekPointRows(games, teams),
    };
  },
});

/** Everything the game detail screen shows, including neighbours for swipe and head-to-head history. */
export const get = query({
  args: { gameId: v.id("games") },
  returns: v.union(
    v.null(),
    v.object({
      game: vGameRow,
      season: v.object({ _id: v.id("seasons"), year: v.number() }),
      userTeam: schema.doc("teams"),
      /** Header fields only the game screen shows (and its edit form needs). */
      header: v.object({
        stadium: v.union(v.string(), v.null()),
        weather: v.union(v.string(), v.null()),
        neutralSite: v.boolean(),
        lineScore: v.union(vLineScore, v.null()),
        /** The quarters were worked out from the scoring plays, so there is nothing to type. */
        quartersFromPlays: v.boolean(),
      }),
      stars: v.array(vStarView),
      userRecordBefore: vWlt,
      previousGameId: v.union(v.id("games"), v.null()),
      nextGameId: v.union(v.id("games"), v.null()),
      headToHead: v.object({ record: vWlt, games: v.array(vHeadToHeadGame) }),
    }),
  ),
  handler: async (ctx, { gameId }) => {
    await requireOwner(ctx);
    // Null rather than an error: an open game page outlives the game when it is deleted.
    const game = await ctx.db.get("games", gameId);
    if (!game) return null;
    const franchise = await activeFranchise(ctx);
    const season = must(await ctx.db.get("seasons", game.seasonId), "Season");
    const games = await seasonGames(ctx, game.seasonId);
    const index = games.findIndex((g) => g._id === game._id);
    const [teams, players] = await Promise.all([teamsById(ctx), loadStarPlayers(ctx, [game])]);

    const meetings = game.opponentTeamId
      ? await ctx.db
          .query("games")
          .withIndex("by_franchiseId_and_opponentTeamId", (q) =>
            q.eq("franchiseId", franchise._id).eq("opponentTeamId", game.opponentTeamId),
          )
          .take(MAX_HEAD_TO_HEAD)
      : [];
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id))
      .take(MAX_SEASONS);
    const yearOf = new Map(seasons.map((s) => [s._id, s.year]));
    const played = meetings.filter((m) => userScore(m) !== null);

    return {
      game: gameRow(game, teams, players),
      season: { _id: season._id, year: season.year },
      userTeam: must(teams.get(franchise.userTeamId), "User team"),
      header: {
        stadium: game.stadium ?? null,
        weather: game.weather ?? null,
        neutralSite: game.neutralSite ?? false,
        lineScore: game.lineScore ?? null,
        quartersFromPlays: quartersFromPlays(game, await gamePlays(ctx, game._id)),
      },
      stars: starViews(game, players),
      userRecordBefore: recordBefore(games, game.weekKey),
      previousGameId: games.slice(0, index).findLast((g) => g.status === "played")?._id ?? null,
      nextGameId: games.slice(index + 1).find((g) => g.status === "played")?._id ?? null,
      headToHead: {
        record: record(played),
        games: played
          .map((m) => ({
            _id: m._id,
            year: yearOf.get(m.seasonId) ?? 0,
            weekKey: m.weekKey,
            result: resultOf(m),
            ...userScore(m)!,
          }))
          .sort((a, b) => b.year - a.year),
      },
    };
  },
});

export const updateNotes = mutation({
  args: { gameId: v.id("games"), notes: v.string() },
  returns: v.null(),
  handler: async (ctx, { gameId, notes }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("games", gameId), "Game");
    const trimmed = notes.trim();
    await ctx.db.patch("games", gameId, { notes: trimmed === "" ? undefined : trimmed });
    return null;
  },
});

/** Saves hand-typed quarter scores (null clears them); they have to add up to the final score. */
export const setLineScore = mutation({
  args: { gameId: v.id("games"), lineScore: v.union(vLineScore, v.null()) },
  returns: v.null(),
  handler: async (ctx, { gameId, lineScore }) => {
    await requireOwner(ctx);
    const { game } = await ownGame(ctx, gameId);
    if (quartersFromPlays(game, await gamePlays(ctx, gameId))) {
      throw invalid("These quarters come from the game's scoring plays; fix the plays instead");
    }
    if (lineScore) {
      const error = lineScoreError(lineScore, {
        home: game.homeScore ?? null,
        away: game.awayScore ?? null,
      });
      if (error) throw invalid(error);
    }
    await ctx.db.patch("games", gameId, { lineScore: lineScore ?? undefined });
    return null;
  },
});
