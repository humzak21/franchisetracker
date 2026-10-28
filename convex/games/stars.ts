/** Stars of the game, picked by hand: who can be picked, and saving the ordered list. */
import { v } from "convex/values";
import { cleanStars } from "../../shared/games/stars";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { vPosition } from "../lib/validators";
import { ownGame } from "./access";

const MAX_LINES_PER_TEAM = 100;
/** A 53-man roster plus practice squad and injured reserve, with room for in-season moves. */
const MAX_ROSTER = 150;

/**
 * Players with a stat line in this game (both teams, the user's first), then the rest of the
 * user team's roster that season. Anyone else is typed in by name.
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
    }),
  ),
  handler: async (ctx, { gameId }) => {
    await requireOwner(ctx);
    const { franchise, game } = await ownGame(ctx, gameId);
    const userTeamId = franchise.userTeamId;
    const sides = [game.homeTeamId, game.awayTeamId]
      .filter((id): id is Id<"teams"> => id !== undefined)
      .sort((a, b) => Number(b === userTeamId) - Number(a === userTeamId));
    const picks: { playerId: Id<"players">; teamId: Id<"teams">; inGame: boolean }[] = [];
    for (const teamId of sides) {
      const lines = await ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
        .take(MAX_LINES_PER_TEAM);
      picks.push(...lines.map((l) => ({ playerId: l.playerId, teamId, inGame: true })));
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
    const out = picks.flatMap((pick) => {
      const player = players.get(pick.playerId);
      return player
        ? [
            {
              ...pick,
              name: player.displayName,
              position: player.position,
              headshotUrl: headshots.get(player._id) ?? null,
            },
          ]
        : [];
    });
    const rosterOnly = out.filter((p) => !p.inGame).sort((a, b) => a.name.localeCompare(b.name));
    return [...out.filter((p) => p.inGame), ...rosterOnly];
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
