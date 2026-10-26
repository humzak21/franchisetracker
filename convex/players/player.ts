import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, teamsById } from "../lib/franchise";
import { headshotUrl } from "../lib/media";
import { seasonYears, toTeamRef, vTeamRef } from "../lib/refs";
import schema from "../schema";

/** Twenty-plus real seasons before the franchise, two splits each, then the franchise run. */
const MAX_ROWS = 160;

/**
 * A player with roster history and season stat rows, both oldest season first. Seasons before
 * `startYear` are imported real history.
 */
export const get = query({
  args: { playerId: v.id("players") },
  returns: v.object({
    player: schema.doc("players"),
    headshotUrl: v.union(v.string(), v.null()),
    startYear: v.number(),
    history: v.array(v.object({ year: v.number(), team: vTeamRef, entry: schema.doc("rosterEntries") })),
    seasons: v.array(v.object({ year: v.number(), team: vTeamRef, stats: schema.doc("seasonPlayerStats") })),
  }),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_ROWS);
    const stats = await ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_ROWS);
    const [years, teams, franchise] = await Promise.all([
      seasonYears(
        ctx,
        [...entries, ...stats].map((row) => row.seasonId),
      ),
      teamsById(ctx),
      activeFranchise(ctx),
    ]);

    const history = entries.flatMap((entry) => {
      const year = years.get(entry.seasonId);
      const team = teams.get(entry.teamId);
      return year !== undefined && team ? [{ year, team: toTeamRef(team), entry }] : [];
    });
    const seasons = stats.flatMap((row) => {
      const year = years.get(row.seasonId);
      const team = teams.get(row.teamId);
      return year !== undefined && team ? [{ year, team: toTeamRef(team), stats: row }] : [];
    });
    history.sort((a, b) => a.year - b.year);
    seasons.sort((a, b) => a.year - b.year);
    return {
      player,
      headshotUrl: await headshotUrl(ctx, player),
      startYear: franchise.startYear,
      history,
      seasons,
    };
  },
});

export const updateNotes = mutation({
  args: { playerId: v.id("players"), notes: v.string() },
  returns: v.null(),
  handler: async (ctx, { playerId, notes }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("players", playerId), "Player");
    await ctx.db.patch("players", playerId, { notes: notes.trim() === "" ? undefined : notes });
    return null;
  },
});
