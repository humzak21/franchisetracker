/**
 * Merging two player entities into one (identity tools, FEATURES.md 5.4): every reference to the
 * duplicate moves to the kept player, then the kept player's aggregates, streaks and the records
 * book are rebuilt from the combined game logs and the duplicate is deleted.
 */
import { mergeAliases } from "../../shared/players/identity";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { refreshRecords } from "../stats/refreshRecords";
import { refreshPlayerStreaks } from "../stats/refreshStreaks";
import { recomputeCareer, recomputePlayerSeason } from "../stats/recompute";

/** A long career's worth of any one kind of reference. */
const MAX_REFS = 600;

type Repointable = "awards" | "draftPicks" | "leagueLeaders" | "hofEntries" | "injuries" | "milestones";

async function repointByPlayerIndex(
  ctx: MutationCtx,
  table: Repointable,
  from: Id<"players">,
  to: Id<"players">,
) {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_playerId", (q) => q.eq("playerId", from))
    .take(MAX_REFS);
  for (const row of rows) await ctx.db.patch(table, row._id, { playerId: to });
}

/** Rows keyed by player and season: the kept player's row wins where both have one. */
async function mergeSeasonRows(
  ctx: MutationCtx,
  table: "rosterEntries" | "playerSnapshots" | "reportedSeasonStats",
  from: Id<"players">,
  to: Id<"players">,
) {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", from))
    .take(MAX_REFS);
  for (const row of rows) {
    const kept = await ctx.db
      .query(table)
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", to).eq("seasonId", row.seasonId))
      .take(MAX_REFS);
    const clash =
      table === "playerSnapshots"
        ? kept.some((k) => "weekKey" in k && "weekKey" in row && k.weekKey === row.weekKey)
        : kept.length > 0;
    if (clash) await ctx.db.delete(table, row._id);
    else await ctx.db.patch(table, row._id, { playerId: to });
  }
}

async function mergeTransactions(ctx: MutationCtx, from: Id<"players">, to: Id<"players">) {
  const links = await ctx.db
    .query("transactionPlayers")
    .withIndex("by_playerId", (q) => q.eq("playerId", from))
    .take(MAX_REFS);
  for (const link of links) {
    await ctx.db.patch("transactionPlayers", link._id, { playerId: to });
    const tx = await ctx.db.get("transactions", link.transactionId);
    if (!tx) continue;
    const swap = (refs: Doc<"transactions">["playersIn"]) =>
      refs.map((r) => (r.playerId === from ? { ...r, playerId: to } : r));
    await ctx.db.patch("transactions", tx._id, {
      playersIn: swap(tx.playersIn),
      playersOut: swap(tx.playersOut),
    });
  }
}

/** Moves the duplicate's game lines (and three-star mentions in those games) to the kept player. */
async function mergeGameLines(ctx: MutationCtx, from: Id<"players">, to: Id<"players">) {
  const lines = await ctx.db
    .query("gameStatLines")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", from))
    .take(MAX_REFS);
  for (const line of lines) {
    const both = await ctx.db
      .query("gameStatLines")
      .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", line.gameId).eq("playerId", to))
      .first();
    // Both in one box score means review split one person in two; the kept line stands.
    if (both) await ctx.db.delete("gameStatLines", line._id);
    else await ctx.db.patch("gameStatLines", line._id, { playerId: to });
    const game = await ctx.db.get("games", line.gameId);
    if (game?.stars?.some((s) => s.playerId === from)) {
      await ctx.db.patch("games", game._id, {
        stars: game.stars.map((s) => (s.playerId === from ? { ...s, playerId: to } : s)),
      });
    }
  }
  return lines;
}

export async function mergePlayers(ctx: MutationCtx, source: Doc<"players">, target: Doc<"players">) {
  const from = source._id;
  const to = target._id;
  const lines = await mergeGameLines(ctx, from, to);
  await mergeSeasonRows(ctx, "rosterEntries", from, to);
  await mergeSeasonRows(ctx, "playerSnapshots", from, to);
  await mergeSeasonRows(ctx, "reportedSeasonStats", from, to);
  for (const table of [
    "awards",
    "draftPicks",
    "leagueLeaders",
    "hofEntries",
    "injuries",
    "milestones",
  ] as const)
    await repointByPlayerIndex(ctx, table, from, to);
  await mergeTransactions(ctx, from, to);

  // Imported season rows move unless the kept player already has that season and split.
  const seasonRows = await ctx.db
    .query("seasonPlayerStats")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", from))
    .take(MAX_REFS);
  const affected = new Set<Id<"seasons">>(lines.map((l) => l.seasonId));
  for (const row of seasonRows) {
    affected.add(row.seasonId);
    const kept = await ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", to).eq("seasonId", row.seasonId))
      .take(MAX_REFS);
    const keep = row.source === "import" && !kept.some((k) => k.source === "import" && k.split === row.split);
    if (keep) await ctx.db.patch("seasonPlayerStats", row._id, { playerId: to });
    else await ctx.db.delete("seasonPlayerStats", row._id);
  }
  for (const table of ["careerPlayerStats", "streaks"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_playerId", (q) => q.eq("playerId", from))
      .take(MAX_REFS);
    for (const row of rows) await ctx.db.delete(table, row._id);
  }

  await ctx.db.patch("players", to, {
    aliases: mergeAliases(target.displayName, target.aliases, [source.displayName, ...source.aliases]),
    espnId: target.espnId ?? source.espnId,
    nflverseId: target.nflverseId ?? source.nflverseId,
    birthYear: target.birthYear ?? source.birthYear,
    college: target.college ?? source.college,
    notes: [target.notes, source.notes].filter(Boolean).join("\n\n") || undefined,
  });
  await ctx.db.delete("players", from);
  if (source.headshotStorageId && source.headshotStorageId !== target.headshotStorageId)
    await ctx.storage.delete(source.headshotStorageId);

  const kept = await ctx.db.get("players", to);
  if (!kept) return;
  for (const seasonId of affected) await recomputePlayerSeason(ctx, kept, seasonId);
  await recomputeCareer(ctx, kept);
  const franchise = await ctx.db.get("franchises", kept.franchiseId);
  const lastGame = lines.length ? await ctx.db.get("games", lines[lines.length - 1]!.gameId) : null;
  if (franchise) {
    await refreshPlayerStreaks(ctx, franchise, kept);
    // Records name holders by id; rebuilding them drops the deleted duplicate from the book.
    if (lastGame) await refreshRecords(ctx, franchise, lastGame);
  }
}
