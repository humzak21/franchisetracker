/**
 * One-off backfill for stars picked before their stat lines came from the box score: a caption
 * that is only a typed stat line ("22/30, 284 yds, 3 TD") now repeats the line shown above it,
 * sometimes with different numbers. This clears such captions on every star whose box score line
 * exists, and keeps captions that say anything else and stars without a line (typed names).
 *
 * Run it from Settings → Maintenance, which lists every caption it would clear first. Idempotent:
 * a second run finds nothing.
 */
import { v } from "convex/values";
import { isTypedStatLine } from "../../shared/games/starLine";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { activeFranchise } from "../lib/franchise";
import { franchiseSeasonList, seasonGames } from "../lib/reports";

/** Clears the captions, or with `dryRun` only lists them. */
export async function clearStarLines(ctx: MutationCtx, dryRun: boolean) {
  const franchise = await activeFranchise(ctx);
  const seasons = (await franchiseSeasonList(ctx, franchise._id)).filter(
    (s) => s.year >= franchise.startYear,
  );
  const cleared: { year: number; weekKey: string; caption: string }[] = [];
  for (const season of seasons) {
    for (const game of await seasonGames(ctx, season._id)) {
      if (!game.stars?.some((s) => s.caption)) continue;
      let changed = false;
      const stars = [];
      for (const star of game.stars) {
        const { caption, ...rest } = star;
        const playerId = star.playerId;
        const line =
          caption && playerId && isTypedStatLine(caption)
            ? await ctx.db
                .query("gameStatLines")
                .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", game._id).eq("playerId", playerId))
                .first()
            : null;
        if (caption && line) {
          cleared.push({ year: season.year, weekKey: game.weekKey, caption });
          changed = true;
          stars.push(rest);
        } else stars.push(star);
      }
      if (changed && !dryRun) await ctx.db.patch("games", game._id, { stars });
    }
  }
  return cleared;
}

export const run = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.array(v.object({ year: v.number(), weekKey: v.string(), caption: v.string() })),
  handler: async (ctx, { dryRun }) => await clearStarLines(ctx, dryRun ?? false),
});
