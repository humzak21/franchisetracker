/** The dashboard's recent transactions and injuries (FEATURES.md 5.1): the user team's latest few. */
import { v } from "convex/values";
import { weekIndex, type WeekKey } from "../../shared/domain";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { vPosition, vTransactionType, vWeekKey } from "../lib/validators";

/** Newest rows read per table; the league-wide log is filtered down to the user team. */
const SCAN = 200;
const SHOWN = 5;

const vName = v.object({
  playerId: v.optional(v.id("players")),
  name: v.string(),
  position: v.optional(vPosition),
});

/** Newest first: in-season weeks descending, then offseason moves (no week). */
const newest = (a: { weekKey?: WeekKey }, b: { weekKey?: WeekKey }) =>
  (b.weekKey ? weekIndex(b.weekKey) : -1) - (a.weekKey ? weekIndex(a.weekKey) : -1);

export const recent = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    moves: v.array(
      v.object({
        _id: v.id("transactions"),
        type: vTransactionType,
        weekKey: v.optional(vWeekKey),
        players: v.array(vName),
        direction: v.union(v.literal("in"), v.literal("out")),
        counterpart: v.union(vTeamRef, v.null()),
      }),
    ),
    injuries: v.array(
      v.object({
        _id: v.id("injuries"),
        weekKey: v.optional(vWeekKey),
        player: vName,
        injuryType: v.string(),
        lengthLabel: v.optional(v.string()),
        onIr: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) return { moves: [], injuries: [] };
    const ours = (row: { teamId?: Id<"teams"> }) =>
      (row.teamId ?? franchise.userTeamId) === franchise.userTeamId;

    const [moveRows, injuryRows] = await Promise.all([
      ctx.db
        .query("transactions")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
        .order("desc")
        .take(SCAN),
      ctx.db
        .query("injuries")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
        .order("desc")
        .take(SCAN),
    ]);
    const moves = moveRows.filter(ours).sort(newest).slice(0, SHOWN);
    const injuries = injuryRows.filter(ours).sort(newest).slice(0, SHOWN);
    const ids = [
      ...moves.flatMap((m) =>
        [...m.playersIn, ...m.playersOut].flatMap((p) => (p.playerId ? [p.playerId] : [])),
      ),
      ...injuries.map((i) => i.playerId),
    ];
    const [players, teams] = await Promise.all([playersById(ctx, ids), teamsById(ctx)]);
    const name = (ref: { playerId?: Id<"players">; rawName?: string }) => {
      const player: Doc<"players"> | undefined = ref.playerId ? players.get(ref.playerId) : undefined;
      return {
        playerId: player?._id,
        name: player?.displayName ?? ref.rawName ?? "Unknown",
        position: player?.position,
      };
    };

    return {
      moves: moves.map((m) => {
        const counterpart = m.counterpartTeamId ? teams.get(m.counterpartTeamId) : undefined;
        return {
          _id: m._id,
          type: m.type,
          weekKey: m.weekKey,
          players: (m.playersIn.length > 0 ? m.playersIn : m.playersOut).map(name),
          direction: m.playersIn.length > 0 ? ("in" as const) : ("out" as const),
          counterpart: counterpart ? toTeamRef(counterpart) : null,
        };
      }),
      injuries: injuries.map((i) => ({
        _id: i._id,
        weekKey: i.weekKey,
        player: name({ playerId: i.playerId }),
        injuryType: i.injuryType,
        lengthLabel: i.lengthLabel,
        onIr: i.onIr,
      })),
    };
  },
});
