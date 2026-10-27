/**
 * Moving a player by hand (no transaction logged): onto another team for a season, or onto IR,
 * the practice squad or the street with the same team. Logged trades and signings live in the
 * transactions domain and update rosters themselves.
 */
import { v } from "convex/values";
import { onRoster } from "../../shared/roster/averages";
import type { Doc } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { literals, vAcquisitionType, vRosterStatus, vWeekKey } from "../lib/validators";

/** One player's entries in one season: a few teams at most, even after moves. */
const MAX_STINTS = 20;

/**
 * Puts the player on `teamId` for the season with `status`. Same team: only the status changes.
 * New team: every entry he still has with another team that season becomes `leaving` (traded by
 * default, or released) as of the week, and the new team's entry is reactivated or created,
 * carrying his ratings over (and his contract, when traded).
 */
export const move = mutation({
  args: {
    playerId: v.id("players"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    status: vRosterStatus,
    statusWeekKey: v.optional(vWeekKey),
    leaving: v.optional(literals(["traded", "released"])),
    acquisitionType: v.optional(vAcquisitionType),
  },
  returns: v.id("rosterEntries"),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", args.playerId), "Player");
    const season = must(await ctx.db.get("seasons", args.seasonId), "Season");
    must(await ctx.db.get("teams", args.teamId), "Team");
    if (season.franchiseId !== player.franchiseId) throw invalid("That season is in another franchise");
    if (args.status === "traded")
      throw invalid("Traded marks the team he left; pick his status with the new team");

    const stints = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", season._id))
      .take(MAX_STINTS);
    const week = args.statusWeekKey;
    const target = stints.find((e) => e.teamId === args.teamId);
    const leaving = args.leaving ?? "traded";
    const departing = stints.filter((e) => e.teamId !== args.teamId && onRoster(e.status));
    for (const entry of departing)
      await ctx.db.patch("rosterEntries", entry._id, { status: leaving, statusWeekKey: week });

    if (target) {
      await ctx.db.patch("rosterEntries", target._id, { status: args.status, statusWeekKey: week });
      return target._id;
    }
    // The entry he leaves (or his latest one this season) carries his ratings to the new team.
    const source: Doc<"rosterEntries"> | undefined = departing.at(-1) ?? stints.at(-1);
    return await ctx.db.insert("rosterEntries", {
      franchiseId: player.franchiseId,
      seasonId: season._id,
      teamId: args.teamId,
      playerId: player._id,
      position: source?.position ?? player.position,
      jersey: source?.jersey,
      ovr: source?.ovr,
      devTrait: source?.devTrait,
      abilities: source?.abilities,
      age: source?.age,
      exp: source?.exp,
      contract: leaving === "traded" ? source?.contract : undefined,
      acquisition: {
        type: args.acquisitionType ?? (leaving === "traded" && source ? "trade" : "free_agent"),
        year: season.year,
      },
      status: args.status,
      statusWeekKey: week,
    });
  },
});
