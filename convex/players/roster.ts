import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, playersById } from "../lib/franchise";
import schema from "../schema";

/** A full roster plus practice squad and IR stays well under this. */
const MAX_ROSTER = 150;

/** A season's roster for one team (the user team by default), each entry joined to its player. */
export const bySeason = query({
  args: { seasonId: v.id("seasons"), teamId: v.optional(v.id("teams")) },
  returns: v.object({
    team: schema.doc("teams"),
    entries: v.array(v.object({ entry: schema.doc("rosterEntries"), player: schema.doc("players") })),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const teamId = args.teamId ?? (await activeFranchise(ctx)).userTeamId;
    const team = must(await ctx.db.get("teams", teamId), "Team");
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", args.seasonId).eq("teamId", teamId))
      .take(MAX_ROSTER);
    const players = await playersById(
      ctx,
      entries.map((e) => e.playerId),
    );
    return {
      team,
      entries: entries.flatMap((entry) => {
        const player = players.get(entry.playerId);
        return player ? [{ entry, player }] : [];
      }),
    };
  },
});
