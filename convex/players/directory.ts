/**
 * The Players index (FEATURES.md 5.4): everyone who has been on a team's roster during the
 * franchise, one row each with their latest entry, plus a name search across every player.
 */
import { v } from "convex/values";
import { ageInSeason } from "../../shared/players/format";
import { onRoster } from "../../shared/roster/averages";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, playersById, MAX_SEASONS } from "../lib/franchise";
import { headshotUrls, toTeamRef, vTeamRef } from "../lib/refs";
import { vPosition } from "../lib/validators";
import { searchPlayers } from "./nameSearch";

const MAX_ROSTER = 150;
const SEARCH_RESULTS = 20;

const vRow = v.object({
  playerId: v.id("players"),
  displayName: v.string(),
  position: vPosition,
  jersey: v.union(v.number(), v.null()),
  ovr: v.union(v.number(), v.null()),
  age: v.union(v.number(), v.null()),
  /** Franchise seasons on this team's roster. */
  seasons: v.number(),
  latestYear: v.number(),
  /** Still on this team's roster in his latest season: not released or traded away. */
  onRoster: v.boolean(),
  isReal: v.boolean(),
  retired: v.boolean(),
  headshotUrl: v.union(v.string(), v.null()),
});

export const byTeam = query({
  args: { teamId: v.optional(v.id("teams")) },
  returns: v.object({ team: vTeamRef, rows: v.array(vRow) }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const teamId = args.teamId ?? franchise.userTeamId;
    const team = must(await ctx.db.get("teams", teamId), "Team");
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) =>
        q.eq("franchiseId", franchise._id).gte("year", franchise.startYear),
      )
      .take(MAX_SEASONS);
    const latest = new Map<Id<"players">, { entry: Doc<"rosterEntries">; year: number; seasons: number }>();
    for (const season of seasons) {
      const entries = await ctx.db
        .query("rosterEntries")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id).eq("teamId", teamId))
        .take(MAX_ROSTER);
      for (const entry of entries) {
        const seen = latest.get(entry.playerId);
        // Seasons come oldest first, so the last entry seen is the latest.
        latest.set(entry.playerId, { entry, year: season.year, seasons: (seen?.seasons ?? 0) + 1 });
      }
    }
    const players = await playersById(ctx, latest.keys());
    const urls = await headshotUrls(ctx, players.values());
    const rows = [...latest.entries()].flatMap(([playerId, { entry, year, seasons: count }]) => {
      const player = players.get(playerId);
      if (!player) return [];
      return [
        {
          playerId,
          displayName: player.displayName,
          position: entry.position,
          jersey: entry.jersey ?? null,
          ovr: entry.ovr ?? null,
          age: entry.age ?? ageInSeason(player, year),
          seasons: count,
          latestYear: year,
          onRoster: onRoster(entry.status),
          isReal: player.isReal,
          retired: player.retired,
          headshotUrl: urls.get(playerId) ?? null,
        },
      ];
    });
    return { team: toTeamRef(team), rows };
  },
});

/** Any player in the franchise by name, real history included, with their career span. */
export const search = query({
  args: { text: v.string() },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      displayName: v.string(),
      position: vPosition,
      isReal: v.boolean(),
      retired: v.boolean(),
      firstYear: v.union(v.number(), v.null()),
      lastYear: v.union(v.number(), v.null()),
      headshotUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { text }) => {
    await requireOwner(ctx);
    const trimmed = text.trim();
    if (trimmed.length < 2) return [];
    const franchise = await activeFranchise(ctx);
    const players = await searchPlayers(ctx, franchise._id, trimmed, SEARCH_RESULTS);
    const urls = await headshotUrls(ctx, players);
    return await Promise.all(
      players.map(async (p) => {
        const careers = await ctx.db
          .query("careerPlayerStats")
          .withIndex("by_playerId", (q) => q.eq("playerId", p._id))
          .take(2);
        const firsts = careers.flatMap((c) => (c.firstYear === undefined ? [] : [c.firstYear]));
        const lasts = careers.flatMap((c) => (c.lastYear === undefined ? [] : [c.lastYear]));
        return {
          playerId: p._id,
          displayName: p.displayName,
          position: p.position,
          isReal: p.isReal,
          retired: p.retired,
          firstYear: firsts.length ? Math.min(...firsts) : null,
          lastYear: lasts.length ? Math.max(...lasts) : null,
          headshotUrl: urls.get(p._id) ?? null,
        };
      }),
    );
  },
});
