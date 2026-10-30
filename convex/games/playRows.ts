/** A game's scoring plays as rows: reading them in order and removing them. */
import { lineScoreFromPlays } from "../../shared/stats/scoring";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Scores in a game; a shootout in Madden's overtime stays well under this. */
export const MAX_PLAYS_PER_GAME = 40;

export async function gamePlays(ctx: QueryCtx, gameId: Id<"games">): Promise<Doc<"scoringPlays">[]> {
  return await ctx.db
    .query("scoringPlays")
    .withIndex("by_gameId_and_order", (q) => q.eq("gameId", gameId))
    .take(MAX_PLAYS_PER_GAME);
}

/** Whether the game's quarters are the ones its plays add up to, rather than typed or printed. */
export function quartersFromPlays(game: Doc<"games">, plays: readonly Doc<"scoringPlays">[]) {
  if (plays.length === 0 || !game.lineScore) return false;
  const line = lineScoreFromPlays(plays);
  const same = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((n, i) => n === b[i]);
  return same(line.home, game.lineScore.home) && same(line.away, game.lineScore.away);
}

export async function deleteScoringPlays(ctx: MutationCtx, gameId: Id<"games">): Promise<void> {
  for (const play of await gamePlays(ctx, gameId)) await ctx.db.delete("scoringPlays", play._id);
}
