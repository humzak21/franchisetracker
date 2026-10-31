/**
 * The yearly retirements step (FEATURES.md 5.3): after a season starts, older players nothing
 * captured has named yet are suggested as retired, on one list to accept whole or pick from.
 */
import { v } from "convex/values";
import { onRoster } from "../../shared/roster/averages";
import { MIN_RETIREMENT_AGE, suggestsRetirement } from "../../shared/roster/retirement";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { playersById, teamsById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { ownSeason } from "../lib/reports";
import { vPosition } from "../lib/validators";
import { recordRetirement } from "../transactions/retire";

/** The whole league's players at or past the youngest suggested age, with headroom. */
const MAX_OLDER_PLAYERS = 800;
/** One player's entries in one season: a few teams at most, even after moves. */
const MAX_STINTS = 20;
/** Each retirement writes a move, so one call stays well inside a mutation's limits. */
const MAX_RETIRING = 150;

/** Suggestions for a season just started: the user team's first, then the oldest. */
export async function retirementSuggestions(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
  season: Doc<"seasons">,
) {
  if (season.status !== "upcoming" || season.year <= franchise.startYear) return [];
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_seasonId_and_age", (q) => q.eq("seasonId", season._id).gte("age", MIN_RETIREMENT_AGE))
    .take(MAX_OLDER_PLAYERS);
  const players = await playersById(
    ctx,
    entries.map((e) => e.playerId),
  );
  const userFirst = (e: Doc<"rosterEntries">) => (e.teamId === franchise.userTeamId ? 0 : 1);
  return entries
    .flatMap((entry) => {
      const player = players.get(entry.playerId);
      const age = entry.age ?? 0;
      const suggested =
        player &&
        suggestsRetirement({ ...player, position: entry.position, status: entry.status, age }, season.year);
      return suggested ? [{ entry, player, age }] : [];
    })
    .sort((a, b) => userFirst(a.entry) - userFirst(b.entry) || b.age - a.age);
}

export const suggestions = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      displayName: v.string(),
      position: vPosition,
      age: v.number(),
      ovr: v.optional(v.number()),
      teamAbbr: v.string(),
      userTeam: v.boolean(),
      headshotUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const { franchise, season } = await ownSeason(ctx, seasonId);
    const rows = await retirementSuggestions(ctx, franchise, season);
    const [teams, photos] = await Promise.all([
      teamsById(ctx),
      headshotUrls(
        ctx,
        rows.map((r) => r.player),
      ),
    ]);
    return rows.map(({ entry, player, age }) => ({
      playerId: player._id,
      displayName: player.displayName,
      position: entry.position,
      age,
      ovr: entry.ovr,
      teamAbbr: teams.get(entry.teamId)?.abbr ?? "",
      userTeam: entry.teamId === franchise.userTeamId,
      headshotUrl: photos.get(player._id) ?? null,
    }));
  },
});

/** Retires the picked players (each a logged move) and closes the season's list. */
export const decide = mutation({
  args: { seasonId: v.id("seasons"), retire: v.array(v.id("players")) },
  returns: v.null(),
  handler: async (ctx, { seasonId, retire }) => {
    await requireOwner(ctx);
    if (retire.length > MAX_RETIRING) throw invalid(`Retire at most ${MAX_RETIRING} players at a time`);
    const { franchise, season } = await ownSeason(ctx, seasonId);
    for (const playerId of retire) {
      const player = must(await ctx.db.get("players", playerId), "Player");
      if (player.franchiseId !== franchise._id) throw invalid("That player is in another franchise");
      const stints = await ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
        .take(MAX_STINTS);
      const stint = stints.find((e) => onRoster(e.status));
      if (!stint) throw invalid(`${player.displayName} is not on a roster this season`);
      await recordRetirement(ctx, { franchise, season, playerId, teamId: stint.teamId });
    }
    await ctx.db.patch("seasons", seasonId, { retirementsReviewed: true });
    return null;
  },
});
