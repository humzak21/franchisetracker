/**
 * Stars of the game, picked by hand: who can be picked (with their line for the game), saving
 * the ordered list, and the box score's one-click star.
 */
import { v } from "convex/values";
import { starStatLine } from "../../shared/games/starLine";
import { cleanStars, MAX_STARS, toggleStar } from "../../shared/games/stars";
import { gameFlow, type StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { MAX_ROSTER, playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { vPosition } from "../lib/validators";
import { ownGame } from "./access";
import { gamePlays } from "./playRows";

const MAX_LINES_PER_TEAM = 100;

/**
 * Players with a stat line in this game (both teams, the user's first), each with the line a
 * star shows, then the rest of the user team's roster that season. Anyone else is typed in by name.
 */
export const candidates = query({
  args: { gameId: v.id("games") },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      name: v.string(),
      position: vPosition,
      headshotUrl: v.union(v.string(), v.null()),
      teamId: v.id("teams"),
      inGame: v.boolean(),
      statLine: v.union(v.string(), v.null()),
      /** He had the game-winning score, so he is an easy suggestion. */
      gameWinner: v.boolean(),
    }),
  ),
  handler: async (ctx, { gameId }) => {
    await requireOwner(ctx);
    const { franchise, game } = await ownGame(ctx, gameId);
    const userTeamId = franchise.userTeamId;
    const sides = [game.homeTeamId, game.awayTeamId]
      .filter((id): id is Id<"teams"> => id !== undefined)
      .sort((a, b) => Number(b === userTeamId) - Number(a === userTeamId));
    const picks: {
      playerId: Id<"players">;
      teamId: Id<"teams">;
      inGame: boolean;
      line?: Doc<"gameStatLines">;
    }[] = [];
    for (const teamId of sides) {
      const lines = await ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
        .take(MAX_LINES_PER_TEAM);
      picks.push(...lines.map((line) => ({ playerId: line.playerId, teamId, inGame: true, line })));
    }
    const roster = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", game.seasonId).eq("teamId", userTeamId))
      .take(MAX_ROSTER);
    const seen = new Set(picks.map((p) => p.playerId));
    picks.push(
      ...roster
        .filter((e) => !seen.has(e.playerId))
        .map((e) => ({ playerId: e.playerId, teamId: userTeamId, inGame: false })),
    );
    const players = await playersById(
      ctx,
      picks.map((p) => p.playerId),
    );
    const headshots = await headshotUrls(ctx, players.values());
    const winnerId = gameFlow(await gamePlays(ctx, gameId)).gameWinner?.playerId;
    const out = picks.flatMap(({ line, ...pick }) => {
      const player = players.get(pick.playerId);
      return player
        ? [
            {
              ...pick,
              name: player.displayName,
              position: player.position,
              headshotUrl: headshots.get(player._id) ?? null,
              statLine: line ? starStatLine(line.position ?? player.position, line.stats as StatLine) : null,
              gameWinner: player._id === winnerId,
            },
          ]
        : [];
    });
    const rosterOnly = out.filter((p) => !p.inGame).sort((a, b) => a.name.localeCompare(b.name));
    const inGame = out.filter((p) => p.inGame).sort((a, b) => Number(b.gameWinner) - Number(a.gameWinner));
    return [...inGame, ...rosterOnly];
  },
});

/** Replaces the game's stars with this ordered list; an empty list clears them. */
export const setStars = mutation({
  args: {
    gameId: v.id("games"),
    stars: v.array(
      v.object({
        playerId: v.optional(v.id("players")),
        rawName: v.optional(v.string()),
        teamId: v.optional(v.id("teams")),
        caption: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { gameId, stars }) => {
    await requireOwner(ctx);
    const { franchise } = await ownGame(ctx, gameId);
    const checked = cleanStars(stars);
    if (!checked.ok) throw invalid(checked.error);
    for (const star of checked.value) {
      if (star.playerId) {
        const player = must(await ctx.db.get("players", star.playerId), "Player");
        if (player.franchiseId !== franchise._id) throw invalid("That player belongs to another franchise");
      }
      if (star.teamId) must(await ctx.db.get("teams", star.teamId), "Team");
    }
    await ctx.db.patch("games", gameId, { stars: checked.value.length > 0 ? checked.value : undefined });
    return null;
  },
});

/**
 * The box score's one-click star: makes a player in this game a star (last in the order) or, if
 * he already is one, takes him out. Returns whether he is a star now.
 */
export const toggle = mutation({
  args: { gameId: v.id("games"), playerId: v.id("players"), teamId: v.id("teams") },
  returns: v.boolean(),
  handler: async (ctx, { gameId, playerId, teamId }) => {
    await requireOwner(ctx);
    const { franchise, game } = await ownGame(ctx, gameId);
    const player = must(await ctx.db.get("players", playerId), "Player");
    if (player.franchiseId !== franchise._id) throw invalid("That player belongs to another franchise");
    if (teamId !== game.homeTeamId && teamId !== game.awayTeamId) {
      throw invalid("That team did not play in this game");
    }
    const stars = game.stars ?? [];
    const next = toggleStar(stars, playerId, { playerId, teamId });
    if (!next) throw invalid(`Pick at most ${MAX_STARS} stars`);
    await ctx.db.patch("games", gameId, { stars: next.length > 0 ? next : undefined });
    return next.length > stars.length;
  },
});
