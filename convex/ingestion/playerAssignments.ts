/** Explicit review choices take precedence over fuzzy name matching for this team and season. */
import { nameTokens } from "../../shared/ingestion/nameMatch";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";

export async function rememberPlayer(
  ctx: MutationCtx,
  args: {
    franchiseId: Id<"franchises">;
    seasonId: Id<"seasons">;
    teamAbbr: string;
    name: string;
    playerId: Id<"players">;
  },
) {
  const normalizedName = nameTokens(args.name).join(" ");
  if (!normalizedName) return;
  const player = must(await ctx.db.get("players", args.playerId), "Player");
  const season = must(await ctx.db.get("seasons", args.seasonId), "Season");
  if (player.franchiseId !== args.franchiseId || season.franchiseId !== args.franchiseId) {
    throw invalid("Player and season must belong to this franchise");
  }
  const existing = await ctx.db
    .query("playerNameAssignments")
    .withIndex("by_franchiseId_and_seasonId_and_teamAbbr_and_normalizedName", (q) =>
      q
        .eq("franchiseId", args.franchiseId)
        .eq("seasonId", args.seasonId)
        .eq("teamAbbr", args.teamAbbr)
        .eq("normalizedName", normalizedName),
    )
    .unique();
  if (existing) {
    if (existing.playerId !== args.playerId)
      await ctx.db.patch("playerNameAssignments", existing._id, { playerId: args.playerId });
  } else {
    await ctx.db.insert("playerNameAssignments", {
      franchiseId: args.franchiseId,
      seasonId: args.seasonId,
      teamAbbr: args.teamAbbr,
      normalizedName,
      playerId: args.playerId,
    });
  }
}
