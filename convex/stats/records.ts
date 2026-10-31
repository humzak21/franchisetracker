/**
 * The records books (FEATURES.md 5.5): the top twenty of every list in the team, franchise-era
 * and all-time books, all-time leaders, and every list a player makes, for his page.
 */
import { v } from "convex/values";
import { RECORD_STATS, STAT_REGISTRY } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { vPosition, vRecordBook, vRecordScope, vStatCategory, vStatSplit, vWeekKey } from "../lib/validators";
import { rankedList } from "./boards";

const MAX_PER_SCOPE = 200;
/** Every list a player can make: three books, two splits, three scopes, every record stat. */
const MAX_PLACEMENTS = 1000;

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());
const vHolder = v.object({ playerId: v.id("players"), name: v.string(), position: vPosition });
const vEntry = v.object({ player: vHolder, value: v.number(), year: v.number() });

const holderOf = (players: Map<Id<"players">, Doc<"players">>, id: Id<"players"> | undefined) => {
  const p = id ? players.get(id) : undefined;
  return p ? { playerId: p._id, name: p.displayName, position: p.position } : null;
};

async function scopeRecords(ctx: QueryCtx, split: Doc<"records">["split"], scope: Doc<"records">["scope"]) {
  const franchise = await activeFranchise(ctx);
  return await ctx.db
    .query("records")
    .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) =>
      q.eq("franchiseId", franchise._id).eq("split", split).eq("scope", scope),
    )
    .take(MAX_PER_SCOPE);
}

const vListEntry = v.object({
  rank: v.number(),
  player: nullable(vHolder),
  /** The holder's name: the player's, or as typed. */
  name: v.string(),
  team: nullable(vTeamRef),
  value: v.number(),
  year: nullable(v.number()),
  /** Career entries: the first season counted. */
  firstYear: nullable(v.number()),
  /** Single-game entries: which game, once the season has been recomputed. */
  gameId: nullable(v.id("games")),
  weekKey: nullable(vWeekKey),
  typedId: nullable(v.id("typedRecords")),
});

/**
 * One book's lists for one category: the top twenty per stat with player, number, team and
 * year. The franchise-era book's record also says where it was set and whose record it broke.
 */
export const lists = query({
  args: { book: vRecordBook, split: vStatSplit, scope: vRecordScope, category: vStatCategory },
  returns: v.object({
    startYear: v.number(),
    lists: v.array(
      v.object({
        statKey: v.string(),
        entries: v.array(vListEntry),
        game: nullable(
          v.object({ _id: v.id("games"), weekKey: vWeekKey, opponentAbbr: nullable(v.string()) }),
        ),
        previous: nullable(v.object({ name: v.string(), value: v.number(), year: nullable(v.number()) })),
      }),
    ),
  }),
  handler: async (ctx, { book, split, scope, category }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const stats = RECORD_STATS.filter((s) => STAT_REGISTRY[s].category === category);
    const ranked = await Promise.all(
      stats.map(async (statKey) => ({
        statKey,
        entries: await rankedList(ctx, franchise, book, { split, scope, statKey }),
      })),
    );
    const records =
      book === "franchise"
        ? new Map((await scopeRecords(ctx, split, scope)).map((r) => [r.statKey, r]))
        : new Map<string, Doc<"records">>();
    const [players, teams] = await Promise.all([
      playersById(ctx, [
        ...ranked.flatMap((l) => l.entries.flatMap((e) => (e.playerId ? [e.playerId as Id<"players">] : []))),
        ...[...records.values()].flatMap((r) => (r.previous?.playerId ? [r.previous.playerId] : [])),
      ]),
      teamsById(ctx),
    ]);
    const lists = await Promise.all(
      ranked
        .filter((l) => l.entries.length > 0)
        .map(async ({ statKey, entries }) => {
          const record = records.get(statKey);
          const game = record?.gameId ? await ctx.db.get("games", record.gameId) : null;
          const previous = record?.previous;
          return {
            statKey,
            entries: entries.map((e) => {
              const player = holderOf(players, e.playerId as Id<"players"> | undefined);
              const team = e.teamId ? teams.get(e.teamId as Id<"teams">) : undefined;
              return {
                rank: e.rank,
                player,
                name: player?.name ?? e.name ?? "Unknown",
                team: team ? toTeamRef(team) : null,
                value: e.value,
                year: e.year ?? null,
                firstYear: e.firstYear ?? null,
                gameId: (e.gameId as Id<"games"> | undefined) ?? null,
                weekKey: e.weekKey ?? null,
                typedId: e.typedId ?? null,
              };
            }),
            game: game
              ? {
                  _id: game._id,
                  weekKey: game.weekKey,
                  opponentAbbr: (game.opponentTeamId && teams.get(game.opponentTeamId)?.abbr) || null,
                }
              : null,
            previous: previous
              ? {
                  name: holderOf(players, previous.playerId)?.name ?? previous.rawName ?? "Unknown",
                  value: previous.value,
                  year: previous.year ?? null,
                }
              : null,
          };
        }),
    );
    return { startYear: franchise.startYear, lists };
  },
});

/** All-time leaders: the franchise era's career top twenty for every stat. */
export const leaders = query({
  args: { split: vStatSplit },
  returns: v.array(v.object({ _id: v.id("records"), statKey: v.string(), top: v.array(vEntry) })),
  handler: async (ctx, { split }) => {
    await requireOwner(ctx);
    const records = await scopeRecords(ctx, split, "career");
    const players = await playersById(
      ctx,
      records.flatMap((r) => r.top.map((t) => t.playerId)),
    );
    return records.map((r) => ({
      _id: r._id,
      statKey: r.statKey,
      top: r.top.flatMap((t) => {
        const player = holderOf(players, t.playerId);
        return player ? [{ player, value: t.value, year: t.year }] : [];
      }),
    }));
  },
});

/**
 * Every list a player makes in any book, best rank first, for his page. Placements stay while
 * he stays in the top twenty; one that falls out goes, as a broken record does.
 */
export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.array(
    v.object({
      _id: v.id("recordPlacements"),
      book: vRecordBook,
      statKey: v.string(),
      scope: vRecordScope,
      split: vStatSplit,
      rank: v.number(),
      value: v.number(),
      year: nullable(v.number()),
      firstYear: nullable(v.number()),
      weekKey: nullable(vWeekKey),
    }),
  ),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const rows = await ctx.db
      .query("recordPlacements")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_PLACEMENTS);
    return rows
      .map((r) => ({
        _id: r._id,
        book: r.book,
        statKey: r.statKey,
        scope: r.scope,
        split: r.split,
        rank: r.rank,
        value: r.value,
        year: r.year ?? null,
        firstYear: r.firstYear ?? null,
        weekKey: r.weekKey ?? null,
      }))
      .sort((a, b) => a.rank - b.rank);
  },
});
