/**
 * Identity tools (FEATURES.md 5.4): rename, aliases, real or fictional, merge duplicates, and
 * apply a name correction from review to every player still carrying the misread name.
 */
import { v } from "convex/values";
import { likelyDuplicate, mergeAliases, splitDisplayName } from "../../shared/players/identity";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { appError, invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vPosition } from "../lib/validators";
import { mergePlayers } from "./merge";

const MAX_NAME = 60;
const MAX_CAPTURED = 400;
const PEERS = 12;
const MAX_CORRECTIONS = 500;

async function named(ctx: QueryCtx, franchiseId: Id<"franchises">, displayName: string) {
  return await ctx.db
    .query("players")
    .withIndex("by_franchiseId_and_displayName", (q) =>
      q.eq("franchiseId", franchiseId).eq("displayName", displayName),
    )
    .take(10);
}

async function rename(ctx: MutationCtx, player: Doc<"players">, name: string) {
  const next = splitDisplayName(name);
  if (!next.displayName || next.displayName.length > MAX_NAME)
    throw invalid(`Names are 1 to ${MAX_NAME} characters`);
  if (next.displayName === player.displayName) return;
  await ctx.db.patch("players", player._id, {
    ...next,
    // The old name stays an alias so screenshots that still print it keep resolving.
    aliases: mergeAliases(next.displayName, player.aliases, [player.displayName]),
  });
}

export const setName = mutation({
  args: { playerId: v.id("players"), displayName: v.string() },
  returns: v.null(),
  handler: async (ctx, { playerId, displayName }) => {
    await requireOwner(ctx);
    await rename(ctx, must(await ctx.db.get("players", playerId), "Player"), displayName);
    return null;
  },
});

export const setAliases = mutation({
  args: { playerId: v.id("players"), aliases: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { playerId, aliases }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    await ctx.db.patch("players", playerId, { aliases: mergeAliases(player.displayName, [], aliases) });
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

/**
 * Captured players (created from box scores, not the import) whose name nearly matches another
 * player at a compatible position: the usual sign of one person entered twice.
 */
export const duplicates = query({
  args: {},
  returns: v.array(v.object({ captured: vSide, match: vSide })),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const captured = await ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_nflverseId", (q) =>
        q.eq("franchiseId", franchise._id).eq("nflverseId", undefined),
      )
      .take(MAX_CAPTURED);
    const pairs: { captured: ReturnType<typeof side>; match: ReturnType<typeof side> }[] = [];
    const seen = new Set<string>();
    for (const player of captured) {
      // Same last name catches typos in the first name; the text search catches them in the last.
      const peers = [
        ...(await ctx.db
          .query("players")
          .withIndex("by_franchiseId_and_lastName", (q) =>
            q.eq("franchiseId", franchise._id).eq("lastName", player.lastName),
          )
          .take(PEERS)),
        ...(await ctx.db
          .query("players")
          .withSearchIndex("search_displayName", (q) =>
            q.search("displayName", player.displayName).eq("franchiseId", franchise._id),
          )
          .take(PEERS)),
      ];
      for (const peer of peers) {
        const key = [player._id, peer._id].sort().join("|");
        if (peer._id === player._id || seen.has(key) || !likelyDuplicate(player, peer)) continue;
        seen.add(key);
        pairs.push({ captured: side(player), match: side(peer) });
      }
    }
    return pairs;
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
    const corrections = await ctx.db
      .query("corrections")
      .withIndex("by_franchiseId_and_targetKey_and_usedAsExample", (q) =>
        q.eq("franchiseId", franchise._id).eq("targetKey", "game_box_score"),
      )
      .order("desc")
      .take(MAX_CORRECTIONS);
    const pairs = new Map<string, { from: string; to: string }>();
    for (const c of corrections) {
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
      const players = await named(ctx, franchise._id, from);
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
    const players = await named(ctx, franchise._id, from.trim());
    const [target] = await named(ctx, franchise._id, splitDisplayName(to).displayName);
    for (const player of players) {
      if (target && target._id !== player._id) await mergePlayers(ctx, player, target);
      else await rename(ctx, player, to);
    }
    return players.length;
  },
});
