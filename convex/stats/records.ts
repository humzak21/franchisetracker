/** The records book, all-time leaders and a player's records, read from the materialized `records` rows. */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { vPosition, vRecordScope, vStatSplit, vWeekKey } from "../lib/validators";

const MAX_PER_SCOPE = 200;

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());
const vHolder = v.object({ playerId: v.id("players"), name: v.string(), position: vPosition });
const vEntry = v.object({ player: vHolder, value: v.number(), year: v.number() });

const vRecordView = v.object({
  _id: v.id("records"),
  statKey: v.string(),
  scope: vRecordScope,
  value: v.number(),
  year: nullable(v.number()),
  holder: nullable(vHolder),
  game: nullable(v.object({ _id: v.id("games"), weekKey: vWeekKey, opponentAbbr: nullable(v.string()) })),
  previous: nullable(v.object({ name: v.string(), value: v.number(), year: nullable(v.number()) })),
  top: v.array(vEntry),
});

const holderOf = (players: Map<Id<"players">, Doc<"players">>, id: Id<"players"> | undefined) => {
  const p = id ? players.get(id) : undefined;
  return p ? { playerId: p._id, name: p.displayName, position: p.position } : null;
};

async function view(ctx: QueryCtx, records: Doc<"records">[], withTop: boolean) {
  const ids = records.flatMap((r) => [
    ...(r.playerId ? [r.playerId] : []),
    ...(r.previous?.playerId ? [r.previous.playerId] : []),
    ...(withTop ? r.top.map((t) => t.playerId) : []),
  ]);
  const players = await playersById(ctx, ids);
  const teams = await teamsById(ctx);
  return await Promise.all(
    records.map(async (r) => {
      const game = r.gameId ? await ctx.db.get("games", r.gameId) : null;
      const previous = r.previous ? holderOf(players, r.previous.playerId) : null;
      return {
        _id: r._id,
        statKey: r.statKey,
        scope: r.scope,
        value: r.value,
        year: r.year ?? null,
        holder: holderOf(players, r.playerId),
        game: game
          ? {
              _id: game._id,
              weekKey: game.weekKey,
              opponentAbbr: (game.opponentTeamId && teams.get(game.opponentTeamId)?.abbr) || null,
            }
          : null,
        previous: r.previous
          ? {
              name: previous?.name ?? r.previous.rawName ?? "Unknown",
              value: r.previous.value,
              year: r.previous.year ?? null,
            }
          : null,
        top: withTop
          ? r.top.flatMap((t) => {
              const player = holderOf(players, t.playerId);
              return player ? [{ player, value: t.value, year: t.year }] : [];
            })
          : [],
      };
    }),
  );
}

async function scopeRecords(ctx: QueryCtx, split: Doc<"records">["split"], scope: Doc<"records">["scope"]) {
  const franchise = await activeFranchise(ctx);
  return await ctx.db
    .query("records")
    .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) =>
      q.eq("franchiseId", franchise._id).eq("split", split).eq("scope", scope),
    )
    .take(MAX_PER_SCOPE);
}

/** Every record in one scope: holder, value, when, and who held it before. */
export const book = query({
  args: { split: vStatSplit, scope: vRecordScope },
  returns: v.array(vRecordView),
  handler: async (ctx, { split, scope }) => {
    await requireOwner(ctx);
    return await view(ctx, await scopeRecords(ctx, split, scope), false);
  },
});

/** All-time leaders: the career top ten for every stat. */
export const leaders = query({
  args: { split: vStatSplit },
  returns: v.array(vRecordView),
  handler: async (ctx, { split }) => {
    await requireOwner(ctx);
    return await view(ctx, await scopeRecords(ctx, split, "career"), true);
  },
});

/** Records a player holds, for their page. */
export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.array(
    v.object({
      _id: v.id("records"),
      statKey: v.string(),
      scope: vRecordScope,
      split: vStatSplit,
      value: v.number(),
      year: nullable(v.number()),
    }),
  ),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const records = await ctx.db
      .query("records")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_PER_SCOPE);
    return records.map((r) => ({
      _id: r._id,
      statKey: r.statKey,
      scope: r.scope,
      split: r.split,
      value: r.value,
      year: r.year ?? null,
    }));
  },
});
