/**
 * The weekly awards batch (FEATURES.md 5.11): a season's players-of-the-week screens uploaded all
 * at once, each its own set. Each is given its week afterwards, the batch is read together, and
 * every set the model read cleanly commits in one go; the rest open in review as usual.
 */
import { v } from "convex/values";
import { isRowDraft, validateDraft } from "../../shared/ingestion/targets";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import type { StoredDraft } from "../lib/draftValidators";
import { invalid } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { ownSeason } from "../lib/reports";
import { vUploadStatus, vWeekKey } from "../lib/validators";
import { commitSet, latestExtraction } from "./commitSet";
import { insertUploads } from "./uploads";
import { readyToExtract, requireSet, setStatus, startExtraction } from "./sets";

const TARGET = "weekly_awards";
/** A regular season's 18 weeks plus retakes. */
const MAX_BATCH = 30;
/** A season's weekly awards uploads, retakes and old sets included. */
const MAX_UPLOADS = 200;

/**
 * Read with every row accepted, every winner known and nothing to check, so it commits without a
 * review. A row that would create a player waits for someone to look at it.
 */
function needsNoReview(draft: StoredDraft | null): boolean {
  if (!draft || !isRowDraft(draft) || draft.rows.length === 0) return false;
  return (
    draft.rows.every((r) => r.accepted && r.playerId !== null) &&
    validateDraft(draft).every((w) => w.severity === "info")
  );
}

const vBatchSet = v.object({
  setKey: v.string(),
  status: vUploadStatus,
  weekKey: v.union(vWeekKey, v.null()),
  error: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  images: v.number(),
  createdAt: v.number(),
  /** Winners read, once the set has been read. */
  winners: v.union(v.number(), v.null()),
  /** Needs no review: commits from the batch. */
  ready: v.boolean(),
});

export const batch = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(vBatchSet),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_seasonId_and_targetKey", (q) => q.eq("seasonId", seasonId).eq("targetKey", TARGET))
      .take(MAX_UPLOADS);
    const sets = new Map<string, Doc<"uploads">[]>();
    for (const upload of uploads) {
      if (upload.franchiseId !== franchise._id || upload.status === "rejected") continue;
      const key = upload.setKey ?? upload._id;
      sets.set(key, [...(sets.get(key) ?? []), upload]);
    }
    return await Promise.all(
      [...sets.entries()].map(async ([setKey, group]) => {
        const lead = group[0]!;
        const status = setStatus(group);
        const extraction = status === "review" ? await latestExtraction(ctx, setKey) : null;
        const draft = extraction ? (extraction.reviewDraft ?? extraction.draft) : null;
        return {
          setKey,
          status,
          weekKey: lead.weekKey ?? null,
          error: group.find((u) => u.error)?.error ?? null,
          imageUrl: await ctx.storage.getUrl(lead.storageId),
          images: group.length,
          createdAt: lead.createdAt,
          winners: draft && isRowDraft(draft) ? draft.rows.filter((r) => r.accepted).length : null,
          ready: needsNoReview(draft),
        };
      }),
    );
  },
});

/** Uploads the batch: one set per screenshot, tagged with the season and waiting for its week. */
export const create = mutation({
  args: {
    seasonId: v.id("seasons"),
    storageIds: v.array(v.id("_storage")),
    sizes: v.optional(v.array(v.object({ width: v.number(), height: v.number() }))),
  },
  returns: v.array(v.string()),
  handler: async (ctx, { seasonId, storageIds, sizes }) => {
    await requireOwner(ctx);
    await ownSeason(ctx, seasonId);
    if (storageIds.length === 0 || storageIds.length > MAX_BATCH) {
      throw invalid(`Upload between 1 and ${MAX_BATCH} screenshots at a time`);
    }
    const keys: string[] = [];
    for (const [i, storageId] of storageIds.entries()) {
      const size = sizes?.[i];
      keys.push(
        ...(await insertUploads(ctx, {
          storageIds: [storageId],
          sizes: size ? [size] : undefined,
          source: "web",
          targetKey: TARGET,
          seasonId,
        })),
      );
    }
    return keys;
  },
});

/** Gives a set its week, or clears it. Until committed the week can change without reading again. */
export const setWeek = mutation({
  args: { setKey: v.string(), weekKey: v.optional(vWeekKey) },
  returns: v.null(),
  handler: async (ctx, { setKey, weekKey }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const uploads = await requireSet(ctx, franchise._id, setKey);
    if (uploads.some((u) => u.targetKey !== TARGET)) throw invalid("These are not weekly awards screenshots");
    if (uploads.some((u) => u.status === "committed")) throw invalid("This week is already committed");
    for (const upload of uploads) await ctx.db.patch("uploads", upload._id, { weekKey });
    return null;
  },
});

/** Reads every set that has its week and has not been read (or failed); returns how many started. */
export const readAll = mutation({
  args: { setKeys: v.array(v.string()) },
  returns: v.number(),
  handler: async (ctx, { setKeys }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    let started = 0;
    for (const key of setKeys.slice(0, MAX_BATCH)) {
      const uploads = await requireSet(ctx, franchise._id, key);
      const status = setStatus(uploads);
      if ((status !== "queued" && status !== "failed") || !readyToExtract(uploads[0]!)) continue;
      await startExtraction(ctx, uploads);
      started++;
    }
    return started;
  },
});

/** Commits every set that is ready (read cleanly, with a week); returns how many committed. */
export const commitReady = mutation({
  args: { setKeys: v.array(v.string()) },
  returns: v.number(),
  handler: async (ctx, { setKeys }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    let committed = 0;
    for (const key of setKeys.slice(0, MAX_BATCH)) {
      const uploads = await requireSet(ctx, franchise._id, key);
      if (setStatus(uploads) !== "review" || !uploads[0]!.weekKey) continue;
      const extraction = await latestExtraction(ctx, key);
      const draft = extraction ? (extraction.reviewDraft ?? extraction.draft) : null;
      if (!draft || !needsNoReview(draft)) continue;
      await commitSet(ctx, franchise, key, draft);
      committed++;
    }
    return committed;
  },
});
