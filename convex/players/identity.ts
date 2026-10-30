/**
 * Identity tools (FEATURES.md 5.4): aliases, real or fictional, merge duplicates, and
 * apply a name correction from review to every player still carrying the misread name.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { TARGET_KEYS } from "../../shared/ingestion/targets";
import { aliasFields, likelyDuplicate, mergeAliases, splitDisplayName } from "../../shared/players/identity";
import { applyPlayerPatch } from "../../shared/players/playerPatch";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { appError, invalid, must } from "../lib/errors";
import { activeFranchise, teamsById } from "../lib/franchise";
import { vPlayerOrigin, vPosition } from "../lib/validators";
import { mergePlayers } from "./merge";
import { searchPlayers } from "./nameSearch";

const PEERS = 12;
/** Most recent corrections read per target; the name fixes among them are what this is after. */
const MAX_CORRECTIONS = 300;

async function named(ctx: QueryCtx, franchiseId: Id<"franchises">, displayName: string) {
  return await ctx.db
    .query("players")
    .withIndex("by_franchiseId_and_displayName", (q) =>
      q.eq("franchiseId", franchiseId).eq("displayName", displayName),
    )
    .take(10);
}

/** Players still carrying a printed name, as a new player would have been stored from it. */
const holders = (ctx: QueryCtx, franchiseId: Id<"franchises">, printed: string) =>
  named(ctx, franchiseId, splitDisplayName(printed).displayName);

/** Renames through the player patch, so the old name stays an alias (`player:update` renames too). */
async function rename(ctx: MutationCtx, player: Doc<"players">, name: string) {
  const result = applyPlayerPatch(player, { displayName: name });
  if (!result.ok) throw invalid(result.error);
  if (result.fields.displayName === player.displayName) return;
  await ctx.db.patch("players", player._id, result.fields);
}

export const setAliases = mutation({
  args: { playerId: v.id("players"), aliases: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { playerId, aliases }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    await ctx.db.patch("players", playerId, aliasFields(mergeAliases(player.displayName, [], aliases)));
    return null;
  },
});

/** Fictional players (draft classes, created players) get a monogram card instead of a photo. */
export const setReal = mutation({
  args: { playerId: v.id("players"), isReal: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { playerId, isReal }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("players", playerId), "Player");
    await ctx.db.patch("players", playerId, { isReal });
    return null;
  },
});

/** Folds `sourceId` into `targetId`; the source is deleted. */
export const merge = mutation({
  args: { sourceId: v.id("players"), targetId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, { sourceId, targetId }) => {
    await requireOwner(ctx);
    if (sourceId === targetId) throw invalid("Pick two different players");
    const source = must(await ctx.db.get("players", sourceId), "Player");
    const target = must(await ctx.db.get("players", targetId), "Player");
    if (source.franchiseId !== target.franchiseId) throw invalid("Players are in different franchises");
    if (source.nflverseId && target.nflverseId && source.nflverseId !== target.nflverseId)
      throw appError("conflict", "Both are distinct real players in the NFL history import");
    await mergePlayers(ctx, source, target);
    return null;
  },
});

const vSide = v.object({
  playerId: v.id("players"),
  displayName: v.string(),
  position: vPosition,
  imported: v.boolean(),
});
const side = (p: Doc<"players">) => ({
  playerId: p._id,
  displayName: p.displayName,
  position: p.position,
  imported: p.nflverseId !== undefined,
});

/** Same last name catches typos in the first name; the text search catches them in the last. */
async function likelyDuplicatesOf(ctx: QueryCtx, player: Doc<"players">) {
  const { franchiseId } = player;
  const peers = [
    ...(await ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_lastName", (q) =>
        q.eq("franchiseId", franchiseId).eq("lastName", player.lastName),
      )
      .take(PEERS)),
    ...(await searchPlayers(ctx, franchiseId, player.displayName, PEERS)),
  ];
  const byId = new Map(peers.map((p) => [p._id, p]));
  return [...byId.values()].filter((p) => p._id !== player._id && likelyDuplicate(player, p));
}

const vPair = v.object({ captured: vSide, match: vSide });

/**
 * A page of captured players (anyone not from the import), newest first, as the pairs whose name
 * nearly matches another player at a compatible position: the usual sign of one person entered
 * twice. A pair of two captured players shows on both their pages; the list keeps one.
 */
export const duplicates = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(vPair),
  handler: async (ctx, { paginationOpts }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const captured = await ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_nflverseId", (q) =>
        q.eq("franchiseId", franchise._id).eq("nflverseId", undefined),
      )
      .order("desc")
      .paginate(paginationOpts);
    const pairs = [];
    for (const player of captured.page) {
      for (const peer of await likelyDuplicatesOf(ctx, player))
        pairs.push({ captured: side(player), match: side(peer) });
    }
    return { ...captured, page: pairs };
  },
});

/** Players who look like this one, for the player page. */
export const duplicatesOf = query({
  args: { playerId: v.id("players") },
  returns: v.array(vSide),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    return (await likelyDuplicatesOf(ctx, player)).map(side);
  },
});

const MAX_SEEN_LINES = 600;
const MAX_SEEN_ROWS = 60;

/**
 * Everywhere a player has turned up: how they got here, their seasons and games, and how screens
 * have printed their name. Enough to judge a merge without opening two player pages.
 */
export const seenIn = query({
  args: { playerId: v.id("players") },
  returns: v.object({
    origin: v.union(vPlayerOrigin, v.null()),
    createdYear: v.union(v.number(), v.null()),
    games: v.number(),
    seasons: v.array(v.object({ year: v.number(), teams: v.array(v.string()), games: v.number() })),
    printed: v.array(v.string()),
  }),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_SEEN_ROWS);
    const lines = await ctx.db
      .query("gameStatLines")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_SEEN_LINES);
    const assignments = await ctx.db
      .query("playerNameAssignments")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_SEEN_ROWS);
    const teams = await teamsById(ctx);
    const seasonIds = [...new Set([...entries, ...lines].map((r) => r.seasonId))];
    const seasons = await Promise.all(seasonIds.map((id) => ctx.db.get("seasons", id)));
    const years = new Map(seasons.flatMap((s) => (s ? [[s._id, s.year] as const] : [])));
    const created = player.createdSeasonId ? await ctx.db.get("seasons", player.createdSeasonId) : null;
    return {
      origin: player.origin ?? null,
      createdYear: created?.year ?? null,
      games: lines.length,
      seasons: seasonIds
        .flatMap((id) => {
          const year = years.get(id);
          if (year === undefined) return [];
          const abbrs = entries.flatMap((e) => {
            const abbr = e.seasonId === id ? teams.get(e.teamId)?.abbr : undefined;
            return abbr ? [abbr] : [];
          });
          return [{ year, teams: abbrs, games: lines.filter((l) => l.seasonId === id).length }];
        })
        .sort((a, b) => a.year - b.year),
      printed: [...new Set(assignments.map((a) => a.normalizedName))],
    };
  },
});

/** Player-name fixes made in review that still match players carrying the misread name. */
export const nameCorrections = query({
  args: {},
  returns: v.array(
    v.object({
      from: v.string(),
      to: v.string(),
      players: v.array(vSide),
      existing: v.union(vSide, v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const corrections = await Promise.all(
      TARGET_KEYS.map((targetKey) =>
        ctx.db
          .query("corrections")
          .withIndex("by_franchiseId_and_targetKey_and_usedAsExample", (q) =>
            q.eq("franchiseId", franchise._id).eq("targetKey", targetKey),
          )
          .order("desc")
          .take(MAX_CORRECTIONS),
      ),
    );
    const pairs = new Map<string, { from: string; to: string }>();
    for (const c of corrections.flat()) {
      if (
        !c.fieldPath.endsWith(".name") ||
        typeof c.extractedValue !== "string" ||
        typeof c.correctedValue !== "string"
      )
        continue;
      const from = c.extractedValue.trim();
      const to = c.correctedValue.trim();
      if (from && to && from !== to) pairs.set(`${from}→${to}`, { from, to });
    }
    const out = [];
    for (const { from, to } of pairs.values()) {
      const players = await holders(ctx, franchise._id, from);
      if (players.length === 0) continue;
      const [existing] = await named(ctx, franchise._id, to);
      out.push({ from, to, players: players.map(side), existing: existing ? side(existing) : null });
    }
    return out;
  },
});

/** Every player named `from` becomes `to`: merged into the player already called that, else renamed. */
export const applyNameCorrection = mutation({
  args: { from: v.string(), to: v.string() },
  returns: v.number(),
  handler: async (ctx, { from, to }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const players = await holders(ctx, franchise._id, from);
    const [target] = await named(ctx, franchise._id, splitDisplayName(to).displayName);
    for (const player of players) {
      if (target && target._id !== player._id) await mergePlayers(ctx, player, target);
      else await rename(ctx, player, to);
    }
    return players.length;
  },
});
