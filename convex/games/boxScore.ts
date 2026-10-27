import { offensiveYards } from "../../shared/stats/teamRegistry";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, playersById } from "../lib/franchise";
import { vPosition, vStatMap } from "../lib/validators";
import schema from "../schema";

const MAX_LINES_PER_TEAM = 100;

const vBoxLine = v.object({
  playerId: v.id("players"),
  name: v.string(),
  position: v.union(vPosition, v.null()),
  jersey: v.union(v.number(), v.null()),
  stats: vStatMap,
});

/** Both teams' player lines and team stats for one game, the user's team first. */
export const get = query({
  args: { gameId: v.id("games") },
  returns: v.object({
    teams: v.array(
      v.object({
        team: schema.doc("teams"),
        isUser: v.boolean(),
        lines: v.array(vBoxLine),
        stats: v.union(vStatMap, v.null()),
      }),
    ),
  }),
  handler: async (ctx, { gameId }) => {
    await requireOwner(ctx);
    const game = must(await ctx.db.get("games", gameId), "Game");
    const franchise = await activeFranchise(ctx);
    const isUser = (id: Id<"teams">) => Number(id === franchise.userTeamId);
    const teamIds = [game.homeTeamId, game.awayTeamId]
      .filter((id): id is Id<"teams"> => id !== undefined)
      .sort((a, b) => isUser(b) - isUser(a));

    const teams = await Promise.all(
      teamIds.map(async (teamId) => {
        const team = must(await ctx.db.get("teams", teamId), "Team");
        const lines = await ctx.db
          .query("gameStatLines")
          .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
          .take(MAX_LINES_PER_TEAM);
        const teamStats = await ctx.db
          .query("gameTeamStats")
          .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
          .unique();
        const players = await playersById(
          ctx,
          lines.map((l) => l.playerId),
        );
        const jerseys = new Map<Id<"players">, number>();
        for (const line of lines) {
          const entries = await ctx.db
            .query("rosterEntries")
            .withIndex("by_playerId_and_seasonId", (q) =>
              q.eq("playerId", line.playerId).eq("seasonId", game.seasonId),
            )
            .take(5);
          const jersey = entries.find((e) => e.teamId === teamId)?.jersey;
          if (jersey !== undefined) jerseys.set(line.playerId, jersey);
        }
        return {
          team,
          isUser: teamId === franchise.userTeamId,
          lines: lines.map((line) => ({
            playerId: line.playerId,
            name: players.get(line.playerId)?.displayName ?? "Unknown player",
            position: line.position ?? players.get(line.playerId)?.position ?? null,
            jersey: jerseys.get(line.playerId) ?? null,
            stats: line.stats,
          })),
          stats: teamStats ? offensiveYards(teamStats.stats) : null,
        };
      }),
    );
    return { teams };
  },
});
