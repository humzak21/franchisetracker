/**
 * Headshots cached from ESPN. The import caches the user team's first roster; the player page
 * caches anyone else the first time it opens. Until then screens use ESPN's URL directly.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { requireOwner, requireOwnerAction } from "../lib/auth";
import { cacheHeadshots } from "../external/media";
import { vEspnLeague } from "../lib/validators";
import type { EspnLeague } from "../../shared/players/espnMatch";
import { MAX_ROSTER } from "../lib/franchise";

const vPending = v.object({ playerId: v.id("players"), espnId: v.number(), league: v.optional(vEspnLeague) });

export const save = internalMutation({
  args: { playerId: v.id("players"), espnId: v.number(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { playerId, espnId, storageId }) => {
    const player = await ctx.db.get("players", playerId);
    // The match changed (or another run won) while the image was downloading.
    if (!player || player.espnId !== espnId || player.headshotStorageId) {
      await ctx.storage.delete(storageId);
      return null;
    }
    await ctx.db.patch("players", playerId, { headshotStorageId: storageId });
    return null;
  },
});

/** Players on the user team's first-season roster who have an ESPN id but no cached photo. */
export const pendingForFranchise = internalQuery({
  args: { franchiseId: v.id("franchises") },
  returns: v.array(vPending),
  handler: async (ctx, { franchiseId }) => {
    const franchise = await ctx.db.get("franchises", franchiseId);
    if (!franchise) return [];
    const season = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) =>
        q.eq("franchiseId", franchiseId).eq("year", franchise.startYear),
      )
      .unique();
    if (!season) return [];
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) =>
        q.eq("seasonId", season._id).eq("teamId", franchise.userTeamId),
      )
      .take(MAX_ROSTER);
    const players = await Promise.all(entries.map((e) => ctx.db.get("players", e.playerId)));
    return players.flatMap((p) =>
      p && p.espnId !== undefined && !p.headshotStorageId
        ? [{ playerId: p._id, espnId: p.espnId, league: p.espnLeague }]
        : [],
    );
  },
});

export const pendingForPlayer = internalQuery({
  args: { playerId: v.id("players") },
  returns: v.array(vPending),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const p = await ctx.db.get("players", playerId);
    return p && p.isReal && p.espnId !== undefined && !p.headshotStorageId
      ? [{ playerId: p._id, espnId: p.espnId, league: p.espnLeague }]
      : [];
  },
});

/** Caches one player's headshot if it is not cached yet. Safe to call on every page view. */
export const ensure = action({
  args: { playerId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, { playerId }) => {
    await requireOwnerAction(ctx);
    const pending: { playerId: Id<"players">; espnId: number; league?: EspnLeague }[] = await ctx.runQuery(
      internal.players.headshots.pendingForPlayer,
      { playerId },
    );
    await cacheHeadshots(ctx, pending);
    return null;
  },
});
