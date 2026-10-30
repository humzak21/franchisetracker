/**
 * Writes a reviewed box score: player entities and roster entries where missing, the game's
 * stat lines (replacing any from an earlier commit), then the affected aggregates.
 */
import type { PlayerOrigin } from "../../shared/domain";
import type { StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { StoredDraft } from "../lib/draftValidators";
import { recomputeCareer, recomputePlayerSeason } from "../stats/recompute";
import { teamByAbbr } from "./commitGame";
import { ensureRosterEntry, playerFor } from "./rowPlayers";

type BoxScore = Extract<StoredDraft, { target: "game_box_score" | "game_log" }>;

/** Two full rosters' worth of lines with room to spare. */
const MAX_LINES_PER_GAME = 200;

export async function commitBoxScore(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  game: Doc<"games">,
  draft: BoxScore,
  origin: PlayerOrigin,
): Promise<Id<"players">[]> {
  const previous = [];
  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    if (!teamId) continue;
    previous.push(
      ...(await ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id).eq("teamId", teamId))
        .take(MAX_LINES_PER_GAME)),
    );
  }
  for (const line of previous) await ctx.db.delete("gameStatLines", line._id);

  const affected = new Map<Id<"players">, Doc<"players">>();
  for (const line of draft.lines) {
    if (Object.keys(line.stats).length === 0) continue;
    const team = await teamByAbbr(ctx, line.teamAbbr);
    const player = await playerFor(ctx, franchise._id, {
      ...line,
      stats: line.stats as StatLine,
      seasonId: game.seasonId,
      teamAbbr: team.abbr,
      origin,
    });
    const position = line.position ?? player.position;
    await ensureRosterEntry(ctx, {
      player,
      seasonId: game.seasonId,
      teamId: team._id,
      userTeamId: franchise.userTeamId,
      position,
    });
    await ctx.db.insert("gameStatLines", {
      franchiseId: franchise._id,
      seasonId: game.seasonId,
      gameId: game._id,
      playerId: player._id,
      teamId: team._id,
      weekKey: game.weekKey,
      position,
      stats: line.stats,
    });
    affected.set(player._id, player);
  }
  // Players dropped from this box score since the last commit lose those games too.
  for (const line of previous) {
    if (affected.has(line.playerId)) continue;
    const player = await ctx.db.get("players", line.playerId);
    if (player) affected.set(player._id, player);
  }
  for (const player of affected.values()) {
    await recomputePlayerSeason(ctx, player, game.seasonId);
    await recomputeCareer(ctx, player);
  }
  return [...affected.keys()];
}
