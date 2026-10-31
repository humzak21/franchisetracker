/** Reads for the move forms: a team's players in a season, to pick who is traded or moved. */
import { v } from "convex/values";
import { POSITIONS } from "../../shared/domain";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { MAX_ROSTER, playersById } from "../lib/franchise";
import { vPosition, vRosterStatus } from "../lib/validators";

/** Players still with the team that season (not traded or released), by position then name. */
export const teamRoster = query({
  args: { seasonId: v.id("seasons"), teamId: v.id("teams") },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      name: v.string(),
      position: vPosition,
      ovr: v.optional(v.number()),
      status: vRosterStatus,
    }),
  ),
  handler: async (ctx, { seasonId, teamId }) => {
    await requireOwner(ctx);
    const entries = (
      await ctx.db
        .query("rosterEntries")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
        .take(MAX_ROSTER)
    ).filter((e) => e.status !== "traded" && e.status !== "released");
    const players = await playersById(
      ctx,
      entries.map((e) => e.playerId),
    );
    return entries
      .flatMap((e) => {
        const p = players.get(e.playerId);
        return p
          ? [{ playerId: p._id, name: p.displayName, position: e.position, ovr: e.ovr, status: e.status }]
          : [];
      })
      .sort(
        (a, b) =>
          POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || a.name.localeCompare(b.name),
      );
  },
});
