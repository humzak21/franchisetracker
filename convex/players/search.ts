import { v } from "convex/values";
import { isPosition, positionGroupOf } from "../../shared/domain";
import { onRoster } from "../../shared/roster/averages";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, MAX_ROSTER, playersById } from "../lib/franchise";
import { vPosition, vRosterStatus } from "../lib/validators";
import { searchPlayers } from "./nameSearch";

const MAX_RESULTS = 12;

/** Players whose name matches the text, for pickers (review's player picker, later the palette). */
export const byName = query({
  args: { text: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("players"),
      displayName: v.string(),
      position: vPosition,
      college: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { text }) => {
    await requireOwner(ctx);
    const trimmed = text.trim();
    if (trimmed.length < 2) return [];
    const franchise = await activeFranchise(ctx);
    const players = await searchPlayers(ctx, franchise._id, trimmed, MAX_RESULTS);
    return players.map((p) => ({
      _id: p._id,
      displayName: p.displayName,
      position: p.position,
      college: p.college ?? null,
    }));
  },
});

/**
 * Who a team has at a position this season, for one-tap picks in review: the name a screen printed
 * is usually someone already here. Active players first; anyone released or traded away is last.
 */
export const teamRoster = query({
  args: { seasonId: v.id("seasons"), teamAbbr: v.string(), position: v.optional(v.string()) },
  returns: v.array(
    v.object({
      _id: v.id("players"),
      displayName: v.string(),
      position: vPosition,
      jersey: v.union(v.number(), v.null()),
      status: vRosterStatus,
    }),
  ),
  handler: async (ctx, { seasonId, teamAbbr, position }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (season?.franchiseId !== franchise._id) return [];
    const team = await ctx.db
      .query("teams")
      .withIndex("by_abbr", (q) => q.eq("abbr", teamAbbr))
      .unique();
    if (!team) return [];
    const group = position && isPosition(position) ? positionGroupOf(position) : null;
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", team._id))
      .take(MAX_ROSTER);
    const fitting = entries
      .filter((e) => !group || positionGroupOf(e.position) === group)
      .sort((a, b) => Number(onRoster(b.status)) - Number(onRoster(a.status)) || (b.ovr ?? 0) - (a.ovr ?? 0))
      .slice(0, MAX_RESULTS);
    const players = await playersById(
      ctx,
      fitting.map((e) => e.playerId),
    );
    return fitting.flatMap((entry) => {
      const player = players.get(entry.playerId);
      return player
        ? [
            {
              _id: player._id,
              displayName: player.displayName,
              position: entry.position,
              jersey: entry.jersey ?? null,
              status: entry.status,
            },
          ]
        : [];
    });
  },
});
