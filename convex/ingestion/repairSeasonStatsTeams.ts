/**
 * One-off repair for season stats committed before rows had to name a team: a row with no
 * printed team was filed under the user's team, so other teams' players got a user-team roster
 * entry and their league stats line said the user's team. This moves each such line back to the
 * player's real team and removes the roster entry the commit made.
 *
 * Run with `npx convex run ingestion/repairSeasonStatsTeams:run '{"dryRun": true}'` first; the
 * answer lists what would move and anyone whose team cannot be told, who can be given one with
 * `assign`. Idempotent: a second run finds nothing to move.
 *
 * `fixMisreads` handles the players a misread name created ("John Jacobs" for Josh Jacobs): each
 * is merged into the real player and his line placed on the team given.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { mergePlayers } from "../players/merge";
import { activeFranchise } from "../lib/franchise";
import { seasonYears } from "../lib/refs";

/** A league's worth of players on one screen, with headroom. */
const MAX_ROWS = 400;
const MAX_ENTRIES = 40;
/** The commit writes the roster entry and the stats line in one mutation, moments apart. */
const SAME_COMMIT_MS = 10_000;

/** The team the player really plays for: another team's entry this season, else his latest earlier one. */
async function realTeam(
  ctx: MutationCtx,
  player: Id<"players">,
  season: Doc<"seasons">,
  userTeamId: Id<"teams">,
): Promise<Id<"teams"> | null> {
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player))
    .take(MAX_ENTRIES);
  const thisSeason = entries.filter((e) => e.seasonId === season._id && e.teamId !== userTeamId);
  if (thisSeason[0]) return thisSeason[0].teamId;
  const years = await seasonYears(
    ctx,
    entries.map((e) => e.seasonId),
  );
  const earlier = entries
    .filter((e) => (years.get(e.seasonId) ?? Infinity) < season.year)
    .sort((a, b) => (years.get(b.seasonId) ?? 0) - (years.get(a.seasonId) ?? 0))[0];
  return earlier && earlier.teamId !== userTeamId ? earlier.teamId : null;
}

/** He really is on the user's team: the entry predates the season stats, or he has user-team box score lines. */
async function genuinelyOurs(
  ctx: MutationCtx,
  reported: Doc<"reportedSeasonStats">,
  entry: Doc<"rosterEntries"> | undefined,
) {
  if (entry && entry._creationTime < reported._creationTime - SAME_COMMIT_MS) return true;
  const line = await ctx.db
    .query("gameStatLines")
    .withIndex("by_playerId_and_seasonId", (q) =>
      q.eq("playerId", reported.playerId).eq("seasonId", reported.seasonId),
    )
    .first();
  return line !== null && line.teamId === reported.teamId;
}

export const run = internalMutation({
  args: {
    dryRun: v.boolean(),
    /** Teams for players the data cannot place, by abbreviation. */
    assign: v.optional(v.array(v.object({ playerId: v.id("players"), teamAbbr: v.string() }))),
  },
  returns: v.object({
    moved: v.array(v.object({ name: v.string(), year: v.number(), to: v.string() })),
    unresolved: v.array(v.object({ playerId: v.id("players"), name: v.string(), year: v.number() })),
  }),
  handler: async (ctx, { dryRun, assign = [] }) => {
    const franchise = await activeFranchise(ctx);
    const userTeamId = franchise.userTeamId;
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) =>
        q.eq("franchiseId", franchise._id).gte("year", franchise.startYear),
      )
      .take(100);
    const moved: { name: string; year: number; to: string }[] = [];
    const unresolved: { playerId: Id<"players">; name: string; year: number }[] = [];

    for (const season of seasons) {
      const rows = await ctx.db
        .query("reportedSeasonStats")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id).eq("teamId", userTeamId))
        .take(MAX_ROWS);
      for (const reported of rows) {
        const player = await ctx.db.get("players", reported.playerId);
        if (!player) continue;
        const entries = await ctx.db
          .query("rosterEntries")
          .withIndex("by_playerId_and_seasonId", (q) =>
            q.eq("playerId", player._id).eq("seasonId", season._id),
          )
          .take(MAX_ENTRIES);
        const ours = entries.find((e) => e.teamId === userTeamId);
        if (await genuinelyOurs(ctx, reported, ours)) continue;

        const given = assign.find((a) => a.playerId === player._id);
        const givenTeam = given
          ? await ctx.db
              .query("teams")
              .withIndex("by_abbr", (q) => q.eq("abbr", given.teamAbbr.toUpperCase()))
              .first()
          : null;
        const teamId = givenTeam?._id ?? (await realTeam(ctx, player._id, season, userTeamId));
        if (!teamId || teamId === userTeamId) {
          unresolved.push({ playerId: player._id, name: player.displayName, year: season.year });
          continue;
        }
        const team = await ctx.db.get("teams", teamId);
        moved.push({ name: player.displayName, year: season.year, to: team?.abbr ?? "?" });
        if (dryRun) continue;

        const theirs = (
          await ctx.db
            .query("reportedSeasonStats")
            .withIndex("by_playerId_and_seasonId", (q) =>
              q.eq("playerId", player._id).eq("seasonId", season._id),
            )
            .take(10)
        ).find((r) => r.teamId === teamId);
        // A line already filed under his real team wins; the misfiled one goes.
        if (theirs) await ctx.db.delete("reportedSeasonStats", reported._id);
        else await ctx.db.patch("reportedSeasonStats", reported._id, { teamId, resolved: undefined });
        if (ours) await ctx.db.delete("rosterEntries", ours._id);
        const remembered = await ctx.db
          .query("playerNameAssignments")
          .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
          .take(MAX_ENTRIES);
        for (const a of remembered) {
          if (a.seasonId === season._id && a.teamAbbr !== team?.abbr) {
            await ctx.db.delete("playerNameAssignments", a._id);
          }
        }
      }
    }
    return { moved, unresolved };
  },
});

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

const vMatch = v.object({
  _id: v.id("players"),
  position: v.string(),
  college: v.union(v.string(), v.null()),
  teams: v.array(v.string()),
  hasSeasonStats: v.boolean(),
});

export const fixMisreads = internalMutation({
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
        done: false,
        skipped,
      };
      if (!dryRun && !skipped && team) {
        const source = sources[0]!;
        const kept = targets[0] ?? source;
        if (kept._id !== source._id) await mergePlayers(ctx, source, kept);
        await placeOn(ctx, kept._id, season._id, userTeam, team);
        row.done = true;
      }
      out.push(row);
    }
    return out;
  },
});
