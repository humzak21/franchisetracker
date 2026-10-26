/**
 * The inbox: storing screenshots, tagging them with a target and context, and listing sets.
 * Tagging a set with everything it needs starts extraction straight away.
 */
import { v } from "convex/values";
import { INGESTION_TARGETS } from "../../shared/ingestion/targets";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vTargetKey } from "../lib/draftValidators";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vUploadSource, vUploadStatus, vWeekKey } from "../lib/validators";
import { MAX_SET_SIZE, readyToExtract, requireSet, setStatus, startExtraction } from "./sets";

/** Recent uploads the inbox shows; older committed sets drop off the end. */
const INBOX_UPLOADS = 200;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const vContext = {
  targetKey: v.optional(vTargetKey),
  seasonId: v.optional(v.id("seasons")),
  weekKey: v.optional(vWeekKey),
  gameId: v.optional(v.id("games")),
};

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

type NewUploads = {
  storageIds: Id<"_storage">[];
  sizes?: { width: number; height: number }[];
  source: Doc<"uploads">["source"];
  targetKey?: Doc<"uploads">["targetKey"];
  seasonId?: Id<"seasons">;
  weekKey?: Doc<"uploads">["weekKey"];
  gameId?: Id<"games">;
};

/**
 * Inserts uploads. Screenshots sent together for a multi-image target form one set; anything
 * else is a set per screenshot. Sets with full context go straight to extraction.
 */
export async function insertUploads(ctx: MutationCtx, args: NewUploads): Promise<string[]> {
  if (args.storageIds.length === 0 || args.storageIds.length > MAX_SET_SIZE) {
    throw invalid(`Send between 1 and ${MAX_SET_SIZE} screenshots at a time`);
  }
  const franchise = await activeFranchise(ctx);
  let { seasonId, weekKey } = args;
  if (args.gameId) {
    const game = must(await ctx.db.get("games", args.gameId), "Game");
    seasonId = game.seasonId;
    weekKey = game.weekKey;
  }
  const grouped = args.targetKey !== undefined && INGESTION_TARGETS[args.targetKey].multiImage;
  const sets = new Map<string, Doc<"uploads">[]>();
  let sharedKey: string | null = null;
  for (const [i, storageId] of args.storageIds.entries()) {
    const file = must(await ctx.db.system.get("_storage", storageId), "Uploaded file");
    if (!file.contentType?.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      await ctx.storage.delete(storageId);
      throw invalid("Only images up to 25 MB can be imported");
    }
    const id = await ctx.db.insert("uploads", {
      franchiseId: franchise._id,
      storageId,
      mime: file.contentType,
      width: args.sizes?.[i]?.width,
      height: args.sizes?.[i]?.height,
      source: args.source,
      targetKey: args.targetKey,
      seasonId,
      weekKey,
      gameId: args.gameId,
      status: "queued",
      createdAt: Date.now(),
    });
    const setKey: string = grouped ? (sharedKey ??= id) : id;
    await ctx.db.patch("uploads", id, { setKey });
    sets.set(setKey, [...(sets.get(setKey) ?? []), must(await ctx.db.get("uploads", id), "Upload")]);
  }
  for (const uploads of sets.values()) if (readyToExtract(uploads[0]!)) await startExtraction(ctx, uploads);
  return [...sets.keys()];
}

export const create = mutation({
  args: {
    storageIds: v.array(v.id("_storage")),
    sizes: v.optional(v.array(v.object({ width: v.number(), height: v.number() }))),
    source: vUploadSource,
    ...vContext,
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await insertUploads(ctx, args);
  },
});

/** The Shortcut endpoint's write path; the HTTP action has already checked the bearer token. */
export const createFromShortcut = internalMutation({
  args: { storageIds: v.array(v.id("_storage")), ...vContext },
  returns: v.array(v.string()),
  handler: async (ctx, args) => await insertUploads(ctx, { ...args, source: "shortcut" }),
});

/**
 * Tags sets with a target and context. With `merge`, the selected sets become one set (several
 * screens of one box score). Sets that are then complete start extracting.
 */
export const tag = mutation({
  args: { setKeys: v.array(v.string()), merge: v.boolean(), ...vContext },
  returns: v.null(),
  handler: async (ctx, { setKeys, merge, ...context }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    if (context.gameId) {
      const game = must(await ctx.db.get("games", context.gameId), "Game");
      context.seasonId = game.seasonId;
      context.weekKey = game.weekKey;
    }
    const sets = await Promise.all(setKeys.map((key) => requireSet(ctx, franchise._id, key)));
    const all = sets.flat();
    if (all.some((u) => u.status === "committed" || u.status === "extracting")) {
      throw invalid("Committed or extracting screenshots cannot be retagged");
    }
    if (merge && all.length > MAX_SET_SIZE) throw invalid(`A set holds at most ${MAX_SET_SIZE} screenshots`);
    const groups = merge ? [all] : sets;
    for (const group of groups) {
      const setKey = group[0]!.setKey;
      for (const upload of group) {
        await ctx.db.patch("uploads", upload._id, { ...context, setKey, status: "queued", error: undefined });
      }
      const updated = await Promise.all(
        group.map(async (u) => must(await ctx.db.get("uploads", u._id), "Upload")),
      );
      if (readyToExtract(updated[0]!)) await startExtraction(ctx, updated);
    }
    return null;
  },
});

/** Re-runs extraction, optionally with a different model. */
export const extract = mutation({
  args: { setKey: v.string(), model: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { setKey, model }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    await startExtraction(ctx, await requireSet(ctx, franchise._id, setKey), model?.trim() || undefined);
    return null;
  },
});

export const reject = mutation({
  args: { setKeys: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { setKeys }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    for (const key of setKeys) {
      for (const upload of await requireSet(ctx, franchise._id, key)) {
        if (upload.status !== "committed") await ctx.db.patch("uploads", upload._id, { status: "rejected" });
      }
    }
    return null;
  },
});

/** Deletes screenshots and their extractions. Committed game data stays. */
export const remove = mutation({
  args: { setKeys: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { setKeys }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    for (const key of setKeys) {
      const extractions = await ctx.db
        .query("extractions")
        .withIndex("by_setKey", (q) => q.eq("setKey", key))
        .take(50);
      for (const extraction of extractions) await ctx.db.delete("extractions", extraction._id);
      for (const upload of await requireSet(ctx, franchise._id, key)) {
        await ctx.storage.delete(upload.storageId);
        await ctx.db.delete("uploads", upload._id);
      }
    }
    return null;
  },
});

const vInboxSet = v.object({
  setKey: v.string(),
  status: vUploadStatus,
  targetKey: v.union(v.string(), v.null()),
  year: v.union(v.number(), v.null()),
  seasonId: v.union(v.id("seasons"), v.null()),
  weekKey: v.union(vWeekKey, v.null()),
  gameId: v.union(v.id("games"), v.null()),
  error: v.union(v.string(), v.null()),
  createdAt: v.number(),
  images: v.array(v.object({ _id: v.id("uploads"), url: v.union(v.string(), v.null()) })),
});

/** Recent sets, newest first, each with its thumbnails. */
export const list = query({
  args: {},
  returns: v.array(vInboxSet),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_franchiseId", (q) => q.eq("franchiseId", franchise._id))
      .order("desc")
      .take(INBOX_UPLOADS);
    const sets = new Map<string, Doc<"uploads">[]>();
    for (const upload of uploads) {
      const key = upload.setKey ?? upload._id;
      sets.set(key, [...(sets.get(key) ?? []), upload]);
    }
    const years = new Map<Id<"seasons">, number>();
    for (const id of new Set(uploads.flatMap((u) => (u.seasonId ? [u.seasonId] : [])))) {
      const season = await ctx.db.get("seasons", id);
      if (season) years.set(id, season.year);
    }
    return await Promise.all(
      [...sets.entries()].map(async ([setKey, group]) => {
        const lead = [...group].sort((a, b) => a._creationTime - b._creationTime)[0]!;
        return {
          setKey,
          status: setStatus(group),
          targetKey: lead.targetKey ?? null,
          year: lead.seasonId ? (years.get(lead.seasonId) ?? null) : null,
          seasonId: lead.seasonId ?? null,
          weekKey: lead.weekKey ?? null,
          gameId: lead.gameId ?? null,
          error: group.find((u) => u.error)?.error ?? null,
          createdAt: lead.createdAt,
          images: await Promise.all(
            group
              .sort((a, b) => a._creationTime - b._creationTime)
              .map(async (u) => ({ _id: u._id, url: await ctx.storage.getUrl(u.storageId) })),
          ),
        };
      }),
    );
  },
});

/** Sets waiting on the user (to tag, review or retry), for the nav badge. */
export const pendingCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await ctx.db
      .query("franchises")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .first();
    if (!franchise) return 0;
    const keys = new Set<string>();
    for (const status of ["queued", "review", "failed"] as const) {
      const uploads = await ctx.db
        .query("uploads")
        .withIndex("by_franchiseId_and_status", (q) =>
          q.eq("franchiseId", franchise._id).eq("status", status),
        )
        .take(100);
      for (const u of uploads) keys.add(u.setKey ?? u._id);
    }
    return keys.size;
  },
});
