/**
 * Games entered by hand: create one (the user's team is always a side), edit its header, or
 * delete it with everything recorded for it. Each runs the same refresh a committed box score does.
 */
import { v } from "convex/values";
import {
  cleanText,
  droppedTeams,
  GAME_TEXT_LIMITS,
  gameFields,
  type GameInput,
} from "../../shared/games/gameForm";
import type { WeekKey } from "../../shared/domain";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { ownSeason } from "../lib/reports";
import { vWeekKey } from "../lib/validators";
import { ownGame } from "./access";
import { deleteScoringPlays } from "./playRows";
import { gameLines, refreshDeletedGame, refreshGame } from "./refreshGame";

const vGameInput = {
  weekKey: vWeekKey,
  bye: v.boolean(),
  opponentTeamId: v.optional(v.id("teams")),
  userIsHome: v.optional(v.boolean()),
  neutralSite: v.optional(v.boolean()),
  us: v.optional(v.union(v.number(), v.null())),
  them: v.optional(v.union(v.number(), v.null())),
  overtime: v.optional(v.boolean()),
  dateLabel: v.optional(v.string()),
  stadium: v.optional(v.string()),
  weather: v.optional(v.string()),
};

/** Milestones and screenshots tied to one game: a game has a handful of each. */
const MAX_PER_GAME = 300;

/** Checks the input and the opponent, returning the fields to store. */
async function checkedFields(ctx: MutationCtx, franchise: Doc<"franchises">, input: GameInput<Id<"teams">>) {
  const checked = gameFields(input, franchise.userTeamId);
  if (!checked.ok) throw invalid(checked.error);
  if (checked.value.opponentTeamId) must(await ctx.db.get("teams", checked.value.opponentTeamId), "Opponent");
  return checked.value;
}

/** One game per week: finding a week's game (screenshot commits, the schedule) relies on it. */
async function assertWeekFree(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
  weekKey: WeekKey,
  except?: Id<"games">,
) {
  const taken = await ctx.db
    .query("games")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
    .first();
  if (taken && taken._id !== except) throw invalid("That week already has a game; edit it instead");
}

export const create = mutation({
  args: { seasonId: v.id("seasons"), notes: v.optional(v.string()), ...vGameInput },
  returns: v.id("games"),
  handler: async (ctx, { seasonId, notes, ...input }) => {
    await requireOwner(ctx);
    const { franchise } = await ownSeason(ctx, seasonId);
    const fields = await checkedFields(ctx, franchise, input);
    await assertWeekFree(ctx, seasonId, fields.weekKey);
    const note = cleanText(notes);
    if ((note?.length ?? 0) > GAME_TEXT_LIMITS.notes) throw invalid("The notes are too long");
    const gameId = await ctx.db.insert("games", {
      franchiseId: franchise._id,
      seasonId,
      ...fields,
      notes: note,
    });
    await refreshGame(ctx, must(await ctx.db.get("games", gameId), "Game"), []);
    return gameId;
  },
});

/** The header: week, opponent, side, score, overtime, date, stadium and weather. Notes save on their own. */
export const update = mutation({
  args: { gameId: v.id("games"), ...vGameInput },
  returns: v.null(),
  handler: async (ctx, { gameId, ...input }) => {
    await requireOwner(ctx);
    const { franchise, game } = await ownGame(ctx, gameId);
    const fields = await checkedFields(ctx, franchise, input);
    const moved = fields.weekKey !== game.weekKey;
    if (moved) await assertWeekFree(ctx, game.seasonId, fields.weekKey, game._id);

    for (const teamId of droppedTeams(game, fields)) {
      const line = await ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
        .first();
      const stats = await ctx.db
        .query("gameTeamStats")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
        .first();
      if (line || stats) {
        const team = await ctx.db.get("teams", teamId);
        throw invalid(
          `Remove the ${team?.abbr ?? "old team"} box score lines and team stats before changing teams`,
        );
      }
    }
    // Scores name their team and stand only for this matchup, so a new opponent starts them over.
    if (droppedTeams(game, fields).length > 0) {
      await deleteScoringPlays(ctx, gameId);
      await ctx.scheduler.runAfter(0, internal.stats.scoring.afterPlays, { gameId });
    }
    // A captured line score only stands while the final score and sides it adds up to do.
    const sameScore =
      fields.homeTeamId === game.homeTeamId &&
      fields.homeScore === game.homeScore &&
      fields.awayScore === game.awayScore;
    await ctx.db.patch("games", gameId, {
      ...fields,
      lineScore: sameScore ? game.lineScore : undefined,
      opponentRecord: fields.opponentTeamId === game.opponentTeamId ? game.opponentRecord : undefined,
    });
    const updated = must(await ctx.db.get("games", gameId), "Game");

    let playerIds: Id<"players">[] = [];
    if (moved) {
      // Lines and milestones carry the week for game logs and splits; a move can change the split.
      const lines = await gameLines(ctx, updated);
      for (const line of lines) await ctx.db.patch("gameStatLines", line._id, { weekKey: fields.weekKey });
      const milestones = await ctx.db
        .query("milestones")
        .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
        .take(MAX_PER_GAME);
      for (const m of milestones) await ctx.db.patch("milestones", m._id, { weekKey: fields.weekKey });
      playerIds = lines.map((l) => l.playerId);
    }
    await refreshGame(ctx, updated, playerIds);
    return null;
  },
});

/** Deletes the game, its stat lines, team stats, scoring plays and milestones; its screenshots stay in the inbox. */
export const remove = mutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, { gameId }) => {
    await requireOwner(ctx);
    const { game } = await ownGame(ctx, gameId);
    const lines = await gameLines(ctx, game);
    for (const line of lines) await ctx.db.delete("gameStatLines", line._id);
    for (const teamId of new Set([game.homeTeamId, game.awayTeamId])) {
      if (!teamId) continue;
      const stats = await ctx.db
        .query("gameTeamStats")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
        .take(5);
      for (const row of stats) await ctx.db.delete("gameTeamStats", row._id);
    }
    const milestones = await ctx.db
      .query("milestones")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .take(MAX_PER_GAME);
    for (const m of milestones) await ctx.db.delete("milestones", m._id);
    await deleteScoringPlays(ctx, gameId);
    // Screenshots keep their season and week, so a later commit finds or creates that week's game.
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .take(MAX_PER_GAME);
    for (const upload of uploads) await ctx.db.patch("uploads", upload._id, { gameId: undefined });
    await ctx.db.delete("games", gameId);
    await refreshDeletedGame(
      ctx,
      game,
      lines.map((l) => l.playerId),
    );
    return null;
  },
});
