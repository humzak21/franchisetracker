import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { teamsById } from "../lib/franchise";
import schema from "../schema";

/** A long career: seasons with the franchise, with headroom for mid-season moves. */
const MAX_ROWS = 60;

async function seasonYears(ctx: QueryCtx, ids: Iterable<Id<"seasons">>): Promise<Map<Id<"seasons">, number>> {
  const unique = [...new Set(ids)];
  const docs = await Promise.all(unique.map((id) => ctx.db.get("seasons", id)));
  return new Map(docs.filter((d): d is Doc<"seasons"> => d !== null).map((d) => [d._id, d.year]));
}

const teamRef = v.object({
  _id: v.id("teams"),
  abbr: v.string(),
  city: v.string(),
  name: v.string(),
  primaryColor: v.string(),
  secondaryColor: v.string(),
});

const toTeamRef = (team: Doc<"teams">) => ({
  _id: team._id,
  abbr: team.abbr,
  city: team.city,
  name: team.name,
  primaryColor: team.primaryColor,
  secondaryColor: team.secondaryColor,
});

/** A player with roster history and season stat rows, both oldest season first. */
export const get = query({
  args: { playerId: v.id("players") },
  returns: v.object({
    player: schema.doc("players"),
    history: v.array(v.object({ year: v.number(), team: teamRef, entry: schema.doc("rosterEntries") })),
    seasons: v.array(v.object({ year: v.number(), team: teamRef, stats: schema.doc("seasonPlayerStats") })),
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
    const [years, teams] = await Promise.all([
      seasonYears(
        ctx,
        [...entries, ...stats].map((row) => row.seasonId),
      ),
      teamsById(ctx),
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
    return { player, history, seasons };
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
