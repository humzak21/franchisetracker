import { v } from "convex/values";
import { withMissingGames } from "../../shared/ingestion/reconcile";
import { applyPlayerPatch } from "../../shared/players/playerPatch";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, teamsById } from "../lib/franchise";
import { headshotUrl } from "../lib/media";
import { seasonYears, toTeamRef, vTeamRef } from "../lib/refs";
import schema from "../schema";
import { vStatMap, vStatSplit } from "../lib/validators";
import { vPlayerPatch } from "./patches";

/** Twenty-plus real seasons before the franchise, two splits each, then the franchise run. */
const MAX_ROWS = 160;

/**
 * A player with roster history and season stat rows, both oldest season first. Seasons before
 * `startYear` are imported real history. Season rows are display copies: see `withMissingGames`.
 */
export const get = query({
  args: { playerId: v.id("players") },
  returns: v.object({
    player: schema.doc("players"),
    headshotUrl: v.union(v.string(), v.null()),
    draftTeamAbbr: v.union(v.string(), v.null()),
    startYear: v.number(),
    history: v.array(v.object({ year: v.number(), team: vTeamRef, entry: schema.doc("rosterEntries") })),
    seasons: v.array(
      v.object({
        year: v.number(),
        team: vTeamRef,
        /** Logs and imports are season rows; `reported` is a captured line with no season row (another team's player). */
        stats: v.object({
          seasonId: v.id("seasons"),
          teamId: v.id("teams"),
          source: v.union(v.literal("logs"), v.literal("import"), v.literal("reported")),
          split: vStatSplit,
          gamesPlayed: v.number(),
          totals: vStatMap,
        }),
        /** Stats showing the season screen's number because a game's box score is missing. */
        overridden: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_ROWS);
    const [stats, reported] = await Promise.all([
      ctx.db
        .query("seasonPlayerStats")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
        .take(MAX_ROWS),
      ctx.db
        .query("reportedSeasonStats")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
        .take(MAX_ROWS),
    ]);
    const [years, teams, franchise] = await Promise.all([
      seasonYears(
        ctx,
        [...entries, ...stats, ...reported].map((row) => row.seasonId),
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
      if (year === undefined || !team) return [];
      // Regular-season log totals show the season screen's number where a game is missing.
      const screen =
        row.source === "logs" && row.split === "regular"
          ? reported.find((r) => r.seasonId === row.seasonId && r.teamId === row.teamId)
          : undefined;
      const { gamesPlayed, totals, overridden } = withMissingGames(row, screen);
      const shown = {
        seasonId: row.seasonId,
        teamId: row.teamId,
        source: row.source as "logs" | "import" | "reported",
        split: row.split,
      };
      return [{ year, team: toTeamRef(team), stats: { ...shown, gamesPlayed, totals }, overridden }];
    });
    // A season captured from a stats screen with no season row of his own: League stats' line.
    for (const line of reported) {
      const year = years.get(line.seasonId);
      const team = teams.get(line.teamId);
      const covered = stats.some((r) => r.seasonId === line.seasonId && r.teamId === line.teamId);
      if (year === undefined || !team || covered) continue;
      seasons.push({
        year,
        team: toTeamRef(team),
        stats: {
          seasonId: line.seasonId,
          teamId: line.teamId,
          source: "reported",
          split: "regular",
          gamesPlayed: line.gamesPlayed ?? 0,
          totals: line.stats,
        },
        overridden: [],
      });
    }
    history.sort((a, b) => a.year - b.year);
    seasons.sort((a, b) => a.year - b.year);
    return {
      player,
      headshotUrl: await headshotUrl(ctx, player),
      draftTeamAbbr: (player.draft?.teamId && teams.get(player.draft.teamId)?.abbr) ?? null,
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

/**
 * Edits the player's own facts: name (the old one stays an alias), position, age, bio, draft
 * slot, undrafted and retired. Season-specific facts live on roster entries (`roster:updateEntry`).
 */
export const update = mutation({
  args: { playerId: v.id("players"), patch: vPlayerPatch },
  returns: v.null(),
  handler: async (ctx, { playerId, patch }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    if (patch.draft?.teamId) must(await ctx.db.get("teams", patch.draft.teamId), "Draft team");
    const result = applyPlayerPatch(player, patch);
    if (!result.ok) throw invalid(result.error);
    await ctx.db.patch("players", playerId, result.fields);
    return null;
  },
});
