/**
 * Transactions and injuries (FEATURES.md 5.10): a season's moves with players, picks, terms and
 * the trade tracker's hindsight notes, and the injury report.
 */
import { v } from "convex/values";
import { weekIndex, type WeekKey } from "../../shared/domain";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { headshotUrls, toTeamRef, vTeamRef } from "../lib/refs";
import { vContract, vPosition, vTransactionType, vWeekKey } from "../lib/validators";

/** A season's league-wide log, with headroom. */
const MAX_ROWS = 1000;
const MAX_NOTE = 2000;

const vPerson = v.object({
  playerId: v.optional(v.id("players")),
  name: v.string(),
  position: v.optional(vPosition),
  headshotUrl: v.union(v.string(), v.null()),
});
const vPick = v.object({ year: v.number(), round: v.number(), origin: v.optional(v.string()) });

/** Offseason moves (no week) come first, then the season in week order. */
const order = (w: WeekKey | undefined) => (w ? weekIndex(w) : -1);

export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      _id: v.id("transactions"),
      type: vTransactionType,
      weekKey: v.optional(vWeekKey),
      team: v.union(vTeamRef, v.null()),
      counterpart: v.union(vTeamRef, v.null()),
      isUser: v.boolean(),
      playersIn: v.array(vPerson),
      playersOut: v.array(vPerson),
      picksIn: v.array(vPick),
      picksOut: v.array(vPick),
      contract: v.optional(vContract),
      capEffect: v.optional(v.number()),
      notes: v.optional(v.string()),
      retrospective: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_ROWS);
    const ids = rows.flatMap((t) =>
      [...t.playersIn, ...t.playersOut].flatMap((p) => (p.playerId ? [p.playerId] : [])),
    );
    const [players, teams] = await Promise.all([playersById(ctx, ids), teamsById(ctx)]);
    const photos = await headshotUrls(ctx, players.values());
    const person = (ref: { playerId?: Id<"players">; rawName?: string }) => {
      const p = ref.playerId ? players.get(ref.playerId) : undefined;
      return {
        playerId: p?._id,
        name: p?.displayName ?? ref.rawName ?? "Unknown",
        position: p?.position,
        headshotUrl: p ? (photos.get(p._id) ?? null) : null,
      };
    };
    const pick = (p: { year: number; round: number; originTeamId?: Id<"teams"> }) => ({
      year: p.year,
      round: p.round,
      origin: p.originTeamId ? teams.get(p.originTeamId)?.abbr : undefined,
    });
    return rows
      .map((t) => {
        const teamId = t.teamId ?? franchise.userTeamId;
        const team = teams.get(teamId);
        const counterpart = t.counterpartTeamId ? teams.get(t.counterpartTeamId) : undefined;
        return {
          _id: t._id,
          type: t.type,
          weekKey: t.weekKey,
          team: team ? toTeamRef(team) : null,
          counterpart: counterpart ? toTeamRef(counterpart) : null,
          isUser: teamId === franchise.userTeamId,
          playersIn: t.playersIn.map(person),
          playersOut: t.playersOut.map(person),
          picksIn: t.picksIn.map(pick),
          picksOut: t.picksOut.map(pick),
          contract: t.contract,
          capEffect: t.capEffect,
          notes: t.notes,
          retrospective: t.retrospective,
        };
      })
      .sort((a, b) => order(a.weekKey) - order(b.weekKey));
  },
});

/** The trade tracker's hindsight note: how a move looks now. */
export const setRetrospective = mutation({
  args: { transactionId: v.id("transactions"), text: v.string() },
  returns: v.null(),
  handler: async (ctx, { transactionId, text }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("transactions", transactionId), "Transaction");
    if (text.length > MAX_NOTE) throw invalid(`Keep it under ${MAX_NOTE} characters`);
    await ctx.db.patch("transactions", transactionId, { retrospective: text.trim() || undefined });
    return null;
  },
});

/** The season's injury report, the user team's first, in week order. */
export const injuries = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      _id: v.id("injuries"),
      weekKey: v.optional(vWeekKey),
      player: vPerson,
      team: v.union(vTeamRef, v.null()),
      isUser: v.boolean(),
      injuryType: v.string(),
      lengthLabel: v.optional(v.string()),
      lengthWeeks: v.optional(v.number()),
      onIr: v.boolean(),
      returnWeekKey: v.optional(vWeekKey),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const rows = await ctx.db
      .query("injuries")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_ROWS);
    const [players, teams] = await Promise.all([
      playersById(
        ctx,
        rows.map((r) => r.playerId),
      ),
      teamsById(ctx),
    ]);
    const photos = await headshotUrls(ctx, players.values());
    return rows
      .map((r) => {
        const p = players.get(r.playerId);
        const teamId = r.teamId ?? franchise.userTeamId;
        const team = teams.get(teamId);
        return {
          _id: r._id,
          weekKey: r.weekKey,
          player: {
            playerId: p?._id,
            name: p?.displayName ?? "Unknown",
            position: p?.position,
            headshotUrl: p ? (photos.get(p._id) ?? null) : null,
          },
          team: team ? toTeamRef(team) : null,
          isUser: teamId === franchise.userTeamId,
          injuryType: r.injuryType,
          lengthLabel: r.lengthLabel,
          lengthWeeks: r.lengthWeeks,
          onIr: r.onIr,
          returnWeekKey: r.returnWeekKey,
          notes: r.notes,
        };
      })
      .sort((a, b) => Number(b.isUser) - Number(a.isUser) || order(a.weekKey) - order(b.weekKey));
  },
});
