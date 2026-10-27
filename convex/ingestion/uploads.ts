/**
 * Storing screenshots and tagging them with a target and context. Tagging a set with
 * everything it needs starts extraction straight away. The inbox listing is in `inbox.ts`.
 */
import { v } from "convex/values";
import { INGESTION_TARGETS } from "../../shared/ingestion/targets";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vTargetKey } from "../lib/draftValidators";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vUploadSource, vWeekKey } from "../lib/validators";
import { MAX_SET_SIZE, readyToExtract, requireSet, startExtraction } from "./sets";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const vContext = {
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
  /** Key for a grouped set that spans several requests (a Shortcut batch) instead of a new one. */
  setKey?: string;
  /** The caller starts extraction once it knows the set is complete. */
  deferExtraction?: boolean;
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
    const setKey: string = grouped ? (sharedKey ??= args.setKey ?? id) : id;
    await ctx.db.patch("uploads", id, { setKey });
    sets.set(setKey, [...(sets.get(setKey) ?? []), must(await ctx.db.get("uploads", id), "Upload")]);
  }
  if (!args.deferExtraction) {
    for (const uploads of sets.values()) if (readyToExtract(uploads[0]!)) await startExtraction(ctx, uploads);
  }
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
