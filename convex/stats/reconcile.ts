/**
 * Reconciliation view (Sprint 6): the season totals a season stats screenshot printed for the
 * user team against the totals derived from its game logs, with how each difference was settled.
 */
import { v } from "convex/values";
import { reconcile, weeksWithoutBoxScore } from "../../shared/ingestion/reconcile";
import type { StatLine } from "../../shared/stats";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { seasonGames } from "../lib/reports";
import { vPosition, vReconcileResolution, vWeekKey } from "../lib/validators";

/** A roster and the players who came and went. */
const MAX_ROWS = 200;

export const get = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    reportedPlayers: v.number(),
    matched: v.number(),
    differences: v.array(
      v.object({
        playerId: v.id("players"),
        player: v.object({
          displayName: v.string(),
          position: vPosition,
          headshotUrl: v.union(v.string(), v.null()),
        }),
        stat: v.string(),
        reported: v.number(),
        logs: v.number(),
        delta: v.number(),
        resolution: v.union(vReconcileResolution, v.null()),
      }),
    ),
    weeksWithoutBoxScore: v.array(vWeekKey),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const teamId = franchise.userTeamId;
    const [reported, logged, games] = await Promise.all([
      ctx.db
        .query("reportedSeasonStats")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
        .take(MAX_ROWS),
      ctx.db
        .query("seasonPlayerStats")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
        .take(MAX_ROWS),
      seasonGames(ctx, seasonId),
    ]);
    const { differences, matched } = reconcile(
      reported.map((r) => ({
        playerId: r.playerId,
        gamesPlayed: r.gamesPlayed,
        stats: r.stats,
        resolved: r.resolved,
      })),
      logged
        .filter((r) => r.source === "logs" && r.split === "regular")
        .map((r) => ({
          playerId: r.playerId,
          gamesPlayed: r.gamesPlayed,
          totals: r.totals as StatLine as Record<string, number>,
        })),
    );
    const players = await playersById(
      ctx,
      differences.map((d) => d.playerId),
    );
    const photos = await headshotUrls(ctx, players.values());
    const boxScores = await Promise.all(
      games.map(async (g) => ({
        weekKey: g.weekKey,
        status: g.status,
        hasBoxScore:
          (await ctx.db
            .query("gameStatLines")
            .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", g._id).eq("teamId", teamId))
            .first()) !== null,
      })),
    );
    return {
      reportedPlayers: reported.length,
      matched,
      differences: differences.flatMap((d) => {
        const p = players.get(d.playerId);
        return p
          ? [
              {
                ...d,
                player: {
                  displayName: p.displayName,
                  position: p.position,
                  headshotUrl: photos.get(p._id) ?? null,
                },
              },
            ]
          : [];
      }),
      weeksWithoutBoxScore: weeksWithoutBoxScore(boxScores),
    };
  },
});

/** Settles one difference (or reopens it with `null`): the log number stands, or a game is missing. */
export const resolve = mutation({
  args: {
    seasonId: v.id("seasons"),
    playerId: v.id("players"),
    stat: v.string(),
    resolution: v.union(vReconcileResolution, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { seasonId, playerId, stat, resolution }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const rows = await ctx.db
      .query("reportedSeasonStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
      .take(10);
    const row = must(
      rows.find((r) => r.teamId === franchise.userTeamId),
      "Reported season stats",
    );
    if (stat !== "gamesPlayed" && !(stat in row.stats)) throw invalid("That stat was not on the screen");
    const resolved = { ...row.resolved };
    if (resolution) resolved[stat] = resolution;
    else delete resolved[stat];
    await ctx.db.patch("reportedSeasonStats", row._id, { resolved });
    return null;
  },
});
