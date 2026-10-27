/**
 * Hand edits to a game's stat lines (box score, a player's game log) and team stats. Each save
 * sets one value or one line and then runs the refresh a committed box score runs, so season
 * stats, records and milestones follow. Setting the same value twice changes nothing.
 */
import { v } from "convex/values";
import { validGameStat, withStat } from "../../shared/games/statEdit";
import { isRawStatKey, type StatLine } from "../../shared/stats";
import { isTeamStatKey } from "../../shared/stats/teamRegistry";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { ensureRosterEntry, playerFor } from "../ingestion/rowPlayers";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { vPosition } from "../lib/validators";
import { ownGame } from "./access";
import { refreshGame } from "./refreshGame";

const vValue = v.union(v.number(), v.null());

function checkValue(value: number | null) {
  if (value !== null && !validGameStat(value)) throw invalid("That number is out of range");
}

function sideOf(game: Doc<"games">, teamId: Id<"teams">) {
  if (teamId !== game.homeTeamId && teamId !== game.awayTeamId)
    throw invalid("That team did not play in this game");
}

async function lineFor(ctx: MutationCtx, gameId: Id<"games">, playerId: Id<"players">) {
  return await ctx.db
    .query("gameStatLines")
    .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", gameId).eq("playerId", playerId))
    .first();
}

/** Sets or clears one stat on a player's line; a line left with no stats is removed. */
export const setStat = mutation({
  args: { gameId: v.id("games"), playerId: v.id("players"), statKey: v.string(), value: vValue },
  returns: v.null(),
  handler: async (ctx, { gameId, playerId, statKey, value }) => {
    await requireOwner(ctx);
    const { game } = await ownGame(ctx, gameId);
    if (!isRawStatKey(statKey)) throw invalid("Only recorded stats can be edited; rates are worked out");
    checkValue(value);
    const line = must(await lineFor(ctx, gameId, playerId), "Stat line");
    const stats = withStat(line.stats, statKey, value);
    if (Object.keys(stats).length === 0) await ctx.db.delete("gameStatLines", line._id);
    else await ctx.db.patch("gameStatLines", line._id, { stats });
    await refreshGame(ctx, game, [playerId]);
    return null;
  },
});

/**
 * Adds a player's line, or merges into the line they already have. Pick a player, or type a
 * name: an exact name match is used, otherwise a new player is created the way a box score
 * commit creates one.
 */
export const addLine = mutation({
  args: {
    gameId: v.id("games"),
    teamId: v.id("teams"),
    playerId: v.optional(v.id("players")),
    name: v.optional(v.string()),
    position: v.optional(vPosition),
    stats: v.record(v.string(), v.number()),
  },
  returns: v.id("players"),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const { franchise, game } = await ownGame(ctx, args.gameId);
    sideOf(game, args.teamId);
    for (const [key, value] of Object.entries(args.stats)) {
      if (!isRawStatKey(key)) throw invalid(`Unknown stat ${key}`);
      checkValue(value);
    }
    if (Object.keys(args.stats).length === 0) throw invalid("Enter at least one stat");
    const name = args.name?.trim() ?? "";
    if (!args.playerId && name === "") throw invalid("Pick a player or type a name");
    if (name.length > 60) throw invalid("Keep the name under 60 characters");

    const known =
      args.playerId ??
      (
        await ctx.db
          .query("players")
          .withIndex("by_franchiseId_and_displayName", (q) =>
            q.eq("franchiseId", franchise._id).eq("displayName", name),
          )
          .first()
      )?._id ??
      null;
    const player = known
      ? must(await ctx.db.get("players", known), "Player")
      : await playerFor(ctx, franchise._id, {
          name,
          playerId: null,
          position: args.position ?? null,
          stats: args.stats as StatLine,
        });
    if (player.franchiseId !== franchise._id) throw invalid("That player belongs to another franchise");
    const position = args.position ?? player.position;
    await ensureRosterEntry(ctx, {
      player,
      seasonId: game.seasonId,
      teamId: args.teamId,
      userTeamId: franchise.userTeamId,
      position,
    });

    const existing = await lineFor(ctx, game._id, player._id);
    if (existing && existing.teamId !== args.teamId)
      throw invalid(`${player.displayName} already has a line for the other team`);
    if (existing)
      await ctx.db.patch("gameStatLines", existing._id, { stats: { ...existing.stats, ...args.stats } });
    else {
      await ctx.db.insert("gameStatLines", {
        franchiseId: franchise._id,
        seasonId: game.seasonId,
        gameId: game._id,
        playerId: player._id,
        teamId: args.teamId,
        weekKey: game.weekKey,
        position,
        stats: args.stats,
      });
    }
    await refreshGame(ctx, game, [player._id]);
    return player._id;
  },
});

/** Removes a player's line from the game. */
export const removeLine = mutation({
  args: { gameId: v.id("games"), playerId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, { gameId, playerId }) => {
    await requireOwner(ctx);
    const { game } = await ownGame(ctx, gameId);
    const lines = await ctx.db
      .query("gameStatLines")
      .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", gameId).eq("playerId", playerId))
      .take(5);
    for (const line of lines) await ctx.db.delete("gameStatLines", line._id);
    await refreshGame(ctx, game, [playerId]);
    return null;
  },
});

/** Sets or clears one team stat (yards, third downs, possession seconds) for one side. */
export const setTeamStat = mutation({
  args: { gameId: v.id("games"), teamId: v.id("teams"), statKey: v.string(), value: vValue },
  returns: v.null(),
  handler: async (ctx, { gameId, teamId, statKey, value }) => {
    await requireOwner(ctx);
    const { franchise, game } = await ownGame(ctx, gameId);
    sideOf(game, teamId);
    if (!isTeamStatKey(statKey)) throw invalid(`Unknown team stat ${statKey}`);
    checkValue(value);
    const row = await ctx.db
      .query("gameTeamStats")
      .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
      .first();
    const stats = withStat(row?.stats ?? {}, statKey, value);
    if (row && Object.keys(stats).length === 0) await ctx.db.delete("gameTeamStats", row._id);
    else if (row) await ctx.db.patch("gameTeamStats", row._id, { stats });
    else if (Object.keys(stats).length > 0) {
      await ctx.db.insert("gameTeamStats", {
        franchiseId: franchise._id,
        seasonId: game.seasonId,
        gameId,
        teamId,
        stats,
      });
    }
    await refreshGame(ctx, game, []);
    return null;
  },
});
