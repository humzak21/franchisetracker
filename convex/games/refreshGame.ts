/**
 * The refresh a hand edit runs, the same one a committed box score runs (`ingestion/review.ts`):
 * each touched player's season and career rows, the season record and lifecycle, then records,
 * streaks and milestones in their own scheduled mutation. Every step rebuilds from the game
 * logs, so running it twice changes nothing.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { refreshSeasonRecord } from "../ingestion/commitGame";
import { must } from "../lib/errors";
import schema from "../schema";
import { recomputeCareer, recomputePlayerSeason } from "../stats/recompute";
import { booksBuilt } from "../stats/recordBuild";
import { refreshRecords } from "../stats/refreshRecords";
import { refreshPlayerStreaks, refreshTeamStreaks } from "../stats/refreshStreaks";

/** Two full rosters' worth of lines with room to spare (as `commitBoxScore`). */
export const MAX_LINES_PER_GAME = 200;

/** Every stat line in the game, both teams. */
export async function gameLines(ctx: MutationCtx, game: Doc<"games">): Promise<Doc<"gameStatLines">[]> {
  const lines: Doc<"gameStatLines">[] = [];
  for (const teamId of new Set([game.homeTeamId, game.awayTeamId])) {
    if (!teamId) continue;
    lines.push(
      ...(await ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id).eq("teamId", teamId))
        .take(MAX_LINES_PER_GAME)),
    );
  }
  return lines;
}

async function recomputePlayers(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
  playerIds: readonly Id<"players">[],
) {
  for (const id of new Set(playerIds)) {
    const player = await ctx.db.get("players", id);
    if (!player) continue;
    await recomputePlayerSeason(ctx, player, seasonId);
    await recomputeCareer(ctx, player);
  }
}

/** After an edit to a game that still exists. */
export async function refreshGame(ctx: MutationCtx, game: Doc<"games">, playerIds: readonly Id<"players">[]) {
  await recomputePlayers(ctx, game.seasonId, playerIds);
  await refreshSeasonRecord(ctx, game.seasonId);
  await ctx.scheduler.runAfter(0, internal.stats.refresh.afterGame, {
    gameId: game._id,
    playerIds: [...new Set(playerIds)],
  });
}

/** After a game is deleted: its lines are gone, so `afterGame` (which needs the game) cannot run. */
export async function refreshDeletedGame(
  ctx: MutationCtx,
  game: Doc<"games">,
  playerIds: readonly Id<"players">[],
) {
  await recomputePlayers(ctx, game.seasonId, playerIds);
  await refreshSeasonRecord(ctx, game.seasonId);
  await ctx.scheduler.runAfter(0, internal.games.refreshGame.afterDelete, {
    game,
    playerIds: [...new Set(playerIds)],
  });
}

/** Records and streaks without the deleted game; milestones went with it. */
export const afterDelete = internalMutation({
  args: { game: schema.doc("games"), playerIds: v.array(v.id("players")) },
  returns: v.null(),
  handler: async (ctx, { game, playerIds }) => {
    const franchise = must(await ctx.db.get("franchises", game.franchiseId), "Franchise");
    for (const id of playerIds) {
      const player = await ctx.db.get("players", id);
      if (player) await refreshPlayerStreaks(ctx, franchise, player);
    }
    // Lowering a record never counts as breaking one, so nothing is reported back here.
    const { changed } = await refreshRecords(ctx, franchise, game);
    if (changed.length > 0 && (await booksBuilt(ctx, franchise._id))) {
      await ctx.scheduler.runAfter(0, internal.stats.recordBuild.placements, {
        franchiseId: franchise._id,
        lists: changed.map((key) => ({ book: "franchise" as const, ...key })),
      });
    }
    await refreshTeamStreaks(ctx, franchise);
    await ctx.scheduler.runAfter(0, internal.stats.scoring.boards, { franchiseId: franchise._id });
    return null;
  },
});
