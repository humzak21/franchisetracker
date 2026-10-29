/** League stats (FEATURES.md 5.5): every player's regular-season totals across the league. */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { leagueSeasonLines } from "../lib/leagueStats";
import { headshotUrls, toTeamRef, vTeamRef } from "../lib/refs";
import { vPosition, vStatMap } from "../lib/validators";

export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    /** The teams the rows name, so each row carries only an id. */
    teams: v.array(vTeamRef),
    rows: v.array(
      v.object({
        playerId: v.id("players"),
        name: v.string(),
        headshotUrl: v.union(v.string(), v.null()),
        position: vPosition,
        teamId: v.id("teams"),
        isUser: v.boolean(),
        source: v.union(v.literal("logs"), v.literal("reported")),
        gamesPlayed: v.number(),
        totals: vStatMap,
      }),
    ),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const lines = await leagueSeasonLines(ctx, franchise, seasonId);
    const [players, teams] = await Promise.all([
      playersById(
        ctx,
        lines.map((l) => l.playerId),
      ),
      teamsById(ctx),
    ]);
    const photos = await headshotUrls(ctx, players.values());
    const rows = lines.flatMap((line) => {
      const player = players.get(line.playerId);
      return player
        ? [
            {
              ...line,
              name: player.displayName,
              headshotUrl: photos.get(player._id) ?? null,
              position: player.position,
            },
          ]
        : [];
    });
    const named = new Set(rows.map((r) => r.teamId));
    return {
      teams: [...teams.values()].filter((t) => named.has(t._id)).map(toTeamRef),
      rows,
    };
  },
});
