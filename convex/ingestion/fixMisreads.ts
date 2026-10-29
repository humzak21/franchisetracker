/**
 * One-off repair for season stats lines filed under the wrong player ("John Jacobs" for Josh
 * Jacobs). When the misread created that player, he is merged into the real one; when it matched
 * a real player already in the database (an old player from the history import), only the
 * season's misfiled line moves, so that player's own career is untouched. Either way the line and
 * its roster entry land on the team given. Dry run first: it lists every player each name matches.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { activeFranchise } from "../lib/franchise";
import { mergePlayers } from "../players/merge";
import { MAX_ENTRIES, SAME_COMMIT_MS } from "./repairSeasonStatsTeams";

async function playersNamed(ctx: MutationCtx, franchiseId: Id<"franchises">, name: string) {
  return await ctx.db
    .query("players")
    .withIndex("by_franchiseId_and_displayName", (q) =>
      q.eq("franchiseId", franchiseId).eq("displayName", name),
    )
    .take(5);
}

/** Moves the player's season off the user's team: his stats line, roster entry and remembered name. */
async function placeOn(
  ctx: MutationCtx,
  player: Id<"players">,
  season: Id<"seasons">,
  userTeam: Doc<"teams">,
  team: Doc<"teams">,
) {
  const reported = await ctx.db
    .query("reportedSeasonStats")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player).eq("seasonId", season))
    .take(10);
  const onTeam = reported.some((r) => r.teamId === team._id);
  for (const r of reported.filter((r) => r.teamId === userTeam._id)) {
    if (onTeam) await ctx.db.delete("reportedSeasonStats", r._id);
    else await ctx.db.patch("reportedSeasonStats", r._id, { teamId: team._id, resolved: undefined });
  }
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player).eq("seasonId", season))
    .take(MAX_ENTRIES);
  const hasTeam = entries.some((e) => e.teamId === team._id);
  for (const e of entries.filter((e) => e.teamId === userTeam._id)) {
    if (hasTeam) await ctx.db.delete("rosterEntries", e._id);
    else await ctx.db.patch("rosterEntries", e._id, { teamId: team._id, partial: true });
  }
  const remembered = await ctx.db
    .query("playerNameAssignments")
    .withIndex("by_playerId", (q) => q.eq("playerId", player))
    .take(MAX_ENTRIES);
  for (const a of remembered) {
    if (a.seasonId === season && a.teamAbbr === userTeam.abbr)
      await ctx.db.delete("playerNameAssignments", a._id);
  }
}

/** The player exists only because a season stats commit made him: he dates from his line. */
async function madeByCommit(
  ctx: MutationCtx,
  player: Doc<"players">,
  season: Id<"seasons">,
  userTeam: Id<"teams">,
) {
  const line = (
    await ctx.db
      .query("reportedSeasonStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", season))
      .take(10)
  ).find((r) => r.teamId === userTeam);
  return line !== undefined && player._creationTime >= line._creationTime - SAME_COMMIT_MS;
}

/** Moves the season's misfiled line from the player it was matched to onto the real one. */
async function moveSeason(
  ctx: MutationCtx,
  source: Id<"players">,
  target: Id<"players">,
  season: Id<"seasons">,
  userTeam: Doc<"teams">,
  team: Doc<"teams">,
) {
  const lines = (
    await ctx.db
      .query("reportedSeasonStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", source).eq("seasonId", season))
      .take(10)
  ).filter((r) => r.teamId === userTeam._id);
  const targetHasLine =
    (await ctx.db
      .query("reportedSeasonStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", target).eq("seasonId", season))
      .first()) !== null;
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", source).eq("seasonId", season))
    .take(MAX_ENTRIES);
  for (const line of lines) {
    // The roster entry the same commit made for him goes with it; an older one is his own.
    for (const e of entries) {
      if (e.teamId === userTeam._id && e._creationTime >= line._creationTime - SAME_COMMIT_MS) {
        await ctx.db.delete("rosterEntries", e._id);
      }
    }
    if (targetHasLine) await ctx.db.delete("reportedSeasonStats", line._id);
    else
      await ctx.db.patch("reportedSeasonStats", line._id, {
        playerId: target,
        teamId: team._id,
        resolved: undefined,
      });
  }
  const remembered = await ctx.db
    .query("playerNameAssignments")
    .withIndex("by_playerId", (q) => q.eq("playerId", source))
    .take(MAX_ENTRIES);
  for (const a of remembered) {
    if (a.seasonId === season && a.teamAbbr === userTeam.abbr)
      await ctx.db.delete("playerNameAssignments", a._id);
  }
}

const vMatch = v.object({
  _id: v.id("players"),
  position: v.string(),
  college: v.union(v.string(), v.null()),
  teams: v.array(v.string()),
  hasSeasonStats: v.boolean(),
});

export const run = internalMutation({
  args: {
    dryRun: v.boolean(),
    year: v.number(),
    fixes: v.array(
      v.object({
        /** The player as the misread created him. */
        name: v.string(),
        /** The real player to merge him into; absent when the name was right. */
        into: v.optional(v.string()),
        teamAbbr: v.string(),
        /** Picks among players sharing a name, from a dry run's answer. */
        sourceId: v.optional(v.id("players")),
        intoId: v.optional(v.id("players")),
      }),
    ),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      into: v.union(v.string(), v.null()),
      team: v.string(),
      sources: v.array(vMatch),
      targets: v.array(vMatch),
      /** merge: the misread made the player; move: he is a real player matched by mistake; place: right player. */
      mode: v.union(v.literal("merge"), v.literal("move"), v.literal("place"), v.null()),
      done: v.boolean(),
      skipped: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { dryRun, year, fixes }) => {
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id).eq("year", year))
      .unique();
    if (!season) throw new Error(`No ${year} season`);
    const userTeam = await ctx.db.get("teams", franchise.userTeamId);
    if (!userTeam) throw new Error("User team missing");
    const describe = async (p: Doc<"players">) => {
      const entries = await ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", p._id).eq("seasonId", season._id))
        .take(MAX_ENTRIES);
      const teams = await Promise.all(
        entries.map(async (e) => (await ctx.db.get("teams", e.teamId))?.abbr ?? "?"),
      );
      const reported = await ctx.db
        .query("reportedSeasonStats")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", p._id).eq("seasonId", season._id))
        .first();
      return {
        _id: p._id,
        position: p.position,
        college: p.college ?? null,
        teams,
        hasSeasonStats: reported !== null,
      };
    };

    const out = [];
    for (const fix of fixes) {
      const team = await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", fix.teamAbbr.toUpperCase()))
        .first();
      const pick = (list: Doc<"players">[], id: Id<"players"> | undefined) =>
        id ? list.filter((p) => p._id === id) : list;
      const sources = pick(await playersNamed(ctx, franchise._id, fix.name), fix.sourceId);
      const targets = fix.into ? pick(await playersNamed(ctx, franchise._id, fix.into), fix.intoId) : [];
      const skipped = !team
        ? `No team ${fix.teamAbbr}`
        : sources.length !== 1
          ? `${sources.length} players named ${fix.name}`
          : fix.into && targets.length !== 1
            ? `${targets.length} players named ${fix.into}`
            : null;
      const row = {
        name: fix.name,
        into: fix.into ?? null,
        team: team?.abbr ?? fix.teamAbbr,
        sources: await Promise.all(sources.map(describe)),
        targets: await Promise.all(targets.map(describe)),
        mode: null as "merge" | "move" | "place" | null,
        done: false,
        skipped,
      };
      const source = sources[0];
      const target = targets[0];
      if (!skipped && team && source) {
        row.mode = !target
          ? "place"
          : (await madeByCommit(ctx, source, season._id, userTeam._id))
            ? "merge"
            : "move";
      }
      if (!dryRun && team && source && row.mode) {
        const kept = target ?? source;
        if (row.mode === "merge") await mergePlayers(ctx, source, kept);
        if (row.mode === "move") await moveSeason(ctx, source._id, kept._id, season._id, userTeam, team);
        await placeOn(ctx, kept._id, season._id, userTeam, team);
        row.done = true;
      }
      out.push(row);
    }
    return out;
  },
});
