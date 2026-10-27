/** The game an owner-only game function acts on, checked against the active franchise. */
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";

export async function ownGame(ctx: QueryCtx, gameId: Id<"games">) {
  const franchise = await activeFranchise(ctx);
  const game = must(await ctx.db.get("games", gameId), "Game");
  if (game.franchiseId !== franchise._id) throw invalid("That game belongs to another franchise");
  return { franchise, game };
}
