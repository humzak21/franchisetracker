/**
 * Rosters carry into the next season (FEATURES.md 5.3): starting a season copies every team's
 * roster from the one before, a year older with a year less on their deal, so the new season opens
 * with the team as it ended. Offseason moves are then recorded on top. Running it again adds only
 * who is still missing.
 */
import { v } from "convex/values";
import { ageInSeason } from "../../shared/players/format";
import { carriedEntry, stillSeen } from "../../shared/roster/carryOver";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { MAX_ROSTER, playersById, teamsById } from "../lib/franchise";
import { ownSeason, seasonByYear } from "../lib/reports";

/**
 * Copies one team's roster from `from` into `to`. A player who already has an entry in `to`
 * (signed elsewhere in the offseason, drafted, or carried over before) and a retired player are
 * skipped, and so is another team's player nothing has named lately: their rosters are assembled
 * from what screens mention, and would otherwise fill with players long gone. Returns how many
 * entries were added.
 */
async function carryTeamOver(
  ctx: MutationCtx,
  from: Doc<"seasons">,
  to: Doc<"seasons">,
  teamId: Id<"teams">,
  userTeam: boolean,
): Promise<number> {
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", from._id).eq("teamId", teamId))
    .take(MAX_ROSTER);
  const players = await playersById(
    ctx,
    entries.map((e) => e.playerId),
  );
  let added = 0;
  for (const entry of entries) {
    const player = players.get(entry.playerId);
    if (!player || player.retired) continue;
    if (!userTeam && !stillSeen(player.lastSeenYear, from.year)) continue;
    const already = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", entry.playerId).eq("seasonId", to._id))
      .first();
    if (already) continue;
    const { _id, _creationTime, ...fields } = entry;
    const carried = carriedEntry(fields, { year: to.year, userTeam });
    if (!carried) continue;
    await ctx.db.insert("rosterEntries", {
      ...carried,
      seasonId: to._id,
      age: carried.age ?? ageInSeason(player, to.year) ?? undefined,
    });
    if (player.lastSeenYear === undefined) {
      await ctx.db.patch("players", player._id, { lastSeenYear: from.year });
    }
    added++;
  }
  return added;
}

/**
 * Carries every team's roster from `from` into `to`. The user team's is copied in this mutation so
 * its roster is there as soon as the season starts; each other team's runs in its own mutation to
 * stay well inside one transaction's limits. Returns the user team's added count.
 */
export async function carryRostersOver(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  from: Doc<"seasons">,
  to: Doc<"seasons">,
): Promise<number> {
  const added = await carryTeamOver(ctx, from, to, franchise.userTeamId, true);
  for (const teamId of (await teamsById(ctx)).keys()) {
    if (teamId === franchise.userTeamId) continue;
    await ctx.scheduler.runAfter(0, internal.players.carryOver.team, {
      from: from._id,
      to: to._id,
      teamId,
    });
  }
  return added;
}

export const team = internalMutation({
  args: { from: v.id("seasons"), to: v.id("seasons"), teamId: v.id("teams") },
  returns: v.number(),
  handler: async (ctx, { from, to, teamId }) => {
    const [fromSeason, toSeason] = await Promise.all([
      must(await ctx.db.get("seasons", from), "Season"),
      must(await ctx.db.get("seasons", to), "Season"),
    ]);
    return await carryTeamOver(ctx, fromSeason, toSeason, teamId, false);
  },
});

/**
 * Brings the previous season's rosters into a season that started without them (seasons added
 * before rosters carried over on their own). Safe to repeat.
 */
export const fromPreviousSeason = mutation({
  args: { seasonId: v.id("seasons") },
  returns: v.object({ added: v.number(), fromYear: v.number() }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const { franchise, season } = await ownSeason(ctx, seasonId);
    if (season.year <= franchise.startYear) {
      throw invalid(`${season.year} is the franchise's first season; there is no roster before it`);
    }
    const previous = must(await seasonByYear(ctx, franchise._id, season.year - 1), "Previous season");
    const added = await carryRostersOver(ctx, franchise, previous, season);
    return { added, fromYear: previous.year };
  },
});
