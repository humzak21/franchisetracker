/** What a game-scoped list is checked against: the game's teams, final and box score. */
import { v } from "convex/values";
import type { RowGameContext } from "../../shared/ingestion/rows/types";
import type { StatLine } from "../../shared/stats";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { playersById } from "./franchise";
import { vStatMap } from "./validators";

/** Two full rosters' worth of lines with room to spare (as `commitBoxScore`). */
const MAX_LINES_PER_TEAM = 100;

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());

export const vRowGameContext = v.object({
  homeAbbr: v.string(),
  awayAbbr: v.string(),
  homeScore: nullable(v.number()),
  awayScore: nullable(v.number()),
  lines: v.array(
    v.object({ playerId: v.id("players"), name: v.string(), teamAbbr: v.string(), stats: vStatMap }),
  ),
});

/** Null when there is no game, or none with two teams yet: nothing to file a list under. */
export async function rowGameContext(
  ctx: QueryCtx,
  gameId: Id<"games"> | null,
): Promise<RowGameContext<Id<"players">> | null> {
  const game = gameId ? await ctx.db.get("games", gameId) : null;
  if (!game?.homeTeamId || !game.awayTeamId || game.status === "bye") return null;
  const [home, away] = await Promise.all([
    ctx.db.get("teams", game.homeTeamId),
    ctx.db.get("teams", game.awayTeamId),
  ]);
  if (!home || !away) return null;
  const lines = (
    await Promise.all(
      [home, away].map(async (team) => {
        const rows = await ctx.db
          .query("gameStatLines")
          .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id).eq("teamId", team._id))
          .take(MAX_LINES_PER_TEAM);
        return rows.map((line) => ({ line, teamAbbr: team.abbr }));
      }),
    )
  ).flat();
  const players = await playersById(
    ctx,
    lines.map(({ line }) => line.playerId),
  );
  return {
    homeAbbr: home.abbr,
    awayAbbr: away.abbr,
    homeScore: game.homeScore ?? null,
    awayScore: game.awayScore ?? null,
    lines: lines.map(({ line, teamAbbr }) => ({
      playerId: line.playerId,
      name: players.get(line.playerId)?.displayName ?? "Unknown player",
      teamAbbr,
      stats: line.stats as StatLine,
    })),
  };
}
