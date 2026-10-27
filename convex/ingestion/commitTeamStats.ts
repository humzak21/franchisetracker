/** Writes a reviewed team stats screen: one `gameTeamStats` row per team, replacing earlier commits. */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { StoredDraft } from "../lib/draftValidators";
import { teamByAbbr } from "./commitGame";

type TeamStats = Extract<StoredDraft, { target: "team_game_stats" | "game_log" }>;

export async function commitTeamStats(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  game: Doc<"games">,
  draft: TeamStats,
): Promise<void> {
  for (const { teamAbbr, stats } of draft.teams) {
    const team = await teamByAbbr(ctx, teamAbbr);
    const existing = await ctx.db
      .query("gameTeamStats")
      .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id).eq("teamId", team._id))
      .unique();
    if (existing) await ctx.db.patch("gameTeamStats", existing._id, { stats });
    else {
      await ctx.db.insert("gameTeamStats", {
        franchiseId: franchise._id,
        seasonId: game.seasonId,
        gameId: game._id,
        teamId: team._id,
        stats,
      });
    }
  }
}
