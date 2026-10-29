/**
 * Rosters carry into the next season (FEATURES.md 5.3): starting a season copies every team's
 * roster from the one before, a year older, so the new season opens with the team as it ended.
 * Offseason moves are then recorded on top. Running it again adds only who is still missing.
 */
import { v } from "convex/values";
import { carriedEntry } from "../../shared/roster/carryOver";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { playersById, teamsById } from "../lib/franchise";
import { ownSeason, seasonByYear } from "../lib/reports";

/** A full roster plus practice squad, IR and the season's departures stays well under this. */
const MAX_ROSTER = 150;

/**
 * Copies one team's roster from `from` into `to`. A player who already has an entry in `to`
 * (signed elsewhere in the offseason, drafted, or carried over before) and a retired player are
 * skipped. Returns how many entries were added.
 */
async function carryTeamOver(
  ctx: MutationCtx,
  from: Id<"seasons">,
  to: Id<"seasons">,
  teamId: Id<"teams">,
): Promise<number> {
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", from).eq("teamId", teamId))
    .take(MAX_ROSTER);
  const players = await playersById(
    ctx,
    entries.map((e) => e.playerId),
  );
  let added = 0;
  for (const entry of entries) {
    if (players.get(entry.playerId)?.retired !== false) continue;
    const already = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", entry.playerId).eq("seasonId", to))
      .first();
    if (already) continue;
    const { _id, _creationTime, ...fields } = entry;
    const carried = carriedEntry(fields);
    if (!carried) continue;
    await ctx.db.insert("rosterEntries", { ...carried, seasonId: to });
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
  from: Id<"seasons">,
  to: Id<"seasons">,
): Promise<number> {
  const added = await carryTeamOver(ctx, from, to, franchise.userTeamId);
  for (const teamId of (await teamsById(ctx)).keys()) {
    if (teamId === franchise.userTeamId) continue;
    await ctx.scheduler.runAfter(0, internal.players.carryOver.team, { from, to, teamId });
  }
  return added;
}

export const team = internalMutation({
  args: { from: v.id("seasons"), to: v.id("seasons"), teamId: v.id("teams") },
  returns: v.number(),
  handler: async (ctx, { from, to, teamId }) => await carryTeamOver(ctx, from, to, teamId),
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
    const added = await carryRostersOver(ctx, franchise, previous._id, season._id);
    return { added, fromYear: previous.year };
  },
});
