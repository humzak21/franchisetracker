/**
 * Awards (FEATURES.md 5.8): a season's weekly and yearly awards, All-Pro and Pro Bowl honors and
 * the user's own team awards; a player's cabinet. League awards arrive from screenshots; team
 * awards are given here.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { headshotUrls, seasonYears, toTeamRef, vTeamRef } from "../lib/refs";
import { ownSeason } from "../lib/reports";
import { vAwardScope, vAwardType, vConference, vPosition, vWeekKey } from "../lib/validators";

/** A season's weekly awards for both conferences plus every honor, with headroom. */
const MAX_AWARDS = 1500;
const MAX_PLAYER_AWARDS = 300;
const MAX_NAME = 60;

export const vAwardPlayer = v.union(
  v.object({
    _id: v.id("players"),
    displayName: v.string(),
    position: vPosition,
    headshotUrl: v.union(v.string(), v.null()),
  }),
  v.null(),
);

export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      _id: v.id("awards"),
      type: vAwardType,
      customName: v.optional(v.string()),
      scope: vAwardScope,
      weekKey: v.optional(vWeekKey),
      conference: v.optional(vConference),
      position: v.optional(vPosition),
      statLine: v.optional(v.string()),
      notes: v.optional(v.string()),
      name: v.string(),
      player: vAwardPlayer,
      team: v.union(vTeamRef, v.null()),
      isUser: v.boolean(),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const awards = await ctx.db
      .query("awards")
      .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", seasonId))
      .take(MAX_AWARDS);
    const [players, teams] = await Promise.all([
      playersById(
        ctx,
        awards.flatMap((a) => (a.playerId ? [a.playerId] : [])),
      ),
      teamsById(ctx),
    ]);
    const photos = await headshotUrls(ctx, players.values());
    return awards.map((a) => {
      const p = a.playerId ? players.get(a.playerId) : undefined;
      const team = a.teamId ? teams.get(a.teamId) : undefined;
      return {
        _id: a._id,
        type: a.type,
        customName: a.customName,
        scope: a.scope,
        weekKey: a.weekKey,
        conference: a.conference,
        position: a.position,
        statLine: a.statLine,
        notes: a.notes,
        name: p?.displayName ?? a.rawName ?? "Unknown",
        player: p
          ? {
              _id: p._id,
              displayName: p.displayName,
              position: p.position,
              headshotUrl: photos.get(p._id) ?? null,
            }
          : null,
        team: team ? toTeamRef(team) : null,
        isUser: a.teamId === franchise.userTeamId,
      };
    });
  },
});

/** A player's awards cabinet, newest season first. */
export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.array(
    v.object({
      _id: v.id("awards"),
      year: v.number(),
      type: vAwardType,
      customName: v.optional(v.string()),
      weekKey: v.optional(vWeekKey),
      conference: v.optional(vConference),
      statLine: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const awards = await ctx.db
      .query("awards")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_PLAYER_AWARDS);
    const years = await seasonYears(
      ctx,
      awards.map((a) => a.seasonId),
    );
    return awards
      .flatMap((a) => {
        const year = years.get(a.seasonId);
        return year === undefined
          ? []
          : [
              {
                _id: a._id,
                year,
                type: a.type,
                customName: a.customName,
                weekKey: a.weekKey,
                conference: a.conference,
                statLine: a.statLine,
              },
            ];
      })
      .sort((a, b) => b.year - a.year);
  },
});

/** A team award the user gives (team MVP, rookie of the year) to a player on the roster. */
export const giveTeamAward = mutation({
  args: {
    seasonId: v.id("seasons"),
    name: v.string(),
    playerId: v.id("players"),
    note: v.optional(v.string()),
  },
  returns: v.id("awards"),
  handler: async (ctx, { seasonId, name, playerId, note }) => {
    await requireOwner(ctx);
    const { franchise } = await ownSeason(ctx, seasonId);
    const award = name.trim();
    if (!award || award.length > MAX_NAME) throw invalid(`Name the award (up to ${MAX_NAME} characters)`);
    const player = must(await ctx.db.get("players", playerId), "Player");
    if (player.franchiseId !== franchise._id) throw invalid("That player belongs to another franchise");
    return await ctx.db.insert("awards", {
      franchiseId: franchise._id,
      seasonId,
      scope: "team",
      type: "custom",
      customName: award,
      playerId,
      teamId: franchise.userTeamId,
      position: player.position,
      notes: note?.trim() || undefined,
    });
  },
});

export const remove = mutation({
  args: { awardId: v.id("awards") },
  returns: v.null(),
  handler: async (ctx, { awardId }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("awards", awardId), "Award");
    await ctx.db.delete("awards", awardId);
    return null;
  },
});
