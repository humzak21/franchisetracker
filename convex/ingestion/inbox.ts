/** The inbox listing: recent upload sets with thumbnails, and the count for the nav badge. */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise } from "../lib/franchise";
import { vUploadStatus, vWeekKey } from "../lib/validators";
import { setStatus } from "./sets";

/** Recent uploads the inbox shows; older committed sets drop off the end. */
const INBOX_UPLOADS = 200;

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
