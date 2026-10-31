/**
 * One-off repair for season stats committed before rows had to name a team: a row with no
 * printed team was filed under the user's team, so other teams' players got a user-team roster
 * entry and their league stats line said the user's team. This moves each such line back to the
 * player's real team and removes the roster entry the commit made.
 *
 * Run it from Settings → Maintenance, which first lists what would move and anyone whose team
 * cannot be told; the CLI's `assign` gives those a team. Idempotent: a second run finds nothing.
 *
 * Lines filed under the wrong player are fixed by `fixMisreads.ts`.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { activeFranchise } from "../lib/franchise";
import { seasonYears } from "../lib/refs";

/** A league's worth of players on one screen, with headroom. */
const MAX_ROWS = 400;
export const MAX_ENTRIES = 40;
/** The commit writes the roster entry and the stats line in one mutation, moments apart. */
export const SAME_COMMIT_MS = 10_000;

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

type Repair = {
  dryRun: boolean;
  /** Teams for players the data cannot place, by abbreviation. */
  assign?: { playerId: Id<"players">; teamAbbr: string }[];
};

/** Moves the lines, or with `dryRun` only lists them. */
export async function repairTeams(ctx: MutationCtx, { dryRun, assign = [] }: Repair) {
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
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", season._id))
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
  handler: async (ctx, args) => await repairTeams(ctx, args),
});
