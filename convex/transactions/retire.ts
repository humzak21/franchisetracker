/** A retirement recorded in one step: the same move Transactions saves, so deleting it undoes it. */
import { planRoster } from "../../shared/transactions";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";
import { applyRoster } from "./rosterEffects";

export async function recordRetirement(
  ctx: MutationCtx,
  args: {
    franchise: Doc<"franchises">;
    season: Doc<"seasons">;
    playerId: Id<"players">;
    teamId: Id<"teams">;
  },
) {
  const { franchise, season, playerId, teamId } = args;
  const transactionId = await ctx.db.insert("transactions", {
    franchiseId: franchise._id,
    seasonId: season._id,
    phase: "offseason",
    type: "retire",
    teamId,
    playersIn: [],
    playersOut: [{ playerId }],
    picksIn: [],
    picksOut: [],
  });
  await ctx.db.insert("transactionPlayers", {
    franchiseId: franchise._id,
    seasonId: season._id,
    transactionId,
    playerId,
    direction: "out",
  });
  const effects = await applyRoster(
    ctx,
    { franchiseId: franchise._id, seasonId: season._id, userTeamId: franchise.userTeamId, extras: new Map() },
    planRoster({
      type: "retire",
      year: season.year,
      teamId,
      playersIn: [],
      playersOut: [playerId],
      teamLabel: must(await ctx.db.get("teams", teamId), "Team").abbr,
      assetsIn: [],
      assetsOut: [],
    }),
  );
  await ctx.db.patch("transactions", transactionId, { effects: { ...effects, picks: [] } });
}
