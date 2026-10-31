/**
 * Backups (FEATURES.md 5.12, 8): every franchise's rows as gzipped JSON in file storage, nightly
 * (convex/crons.ts) and on demand. The JSON is written and compressed a page at a time, so a
 * backup of the whole real NFL history never sits in the action's memory at once. Restores run
 * in the browser (Settings → Data) through `restoreData.ts`.
 */
import { Gzip, strToU8 } from "fflate";
import { v } from "convex/values";
import { writeBackup } from "../../shared/ops/restore";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction, internalMutation, type ActionCtx } from "../_generated/server";
import { requireOwnerAction } from "../lib/auth";

/** Rows read per page: well inside a query's read limits even for wide stat rows. */
const PAGE_SIZE = 1000;

async function runBackup(ctx: ActionCtx, kind: "scheduled" | "manual"): Promise<Id<"backups">> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  // fflate allocates plain ArrayBuffers; its types only promise ArrayBufferLike.
  const gzip = new Gzip({ level: 6 }, (data) => chunks.push(data as Uint8Array<ArrayBuffer>));
  const { counts, franchises } = await writeBackup(
    {
      page: (table, cursor) =>
        ctx.runQuery(internal.ops.backupData.page, {
          table,
          paginationOpts: { numItems: PAGE_SIZE, cursor },
        }),
      teams: () => ctx.runQuery(internal.ops.backupData.teams, {}),
    },
    (text) => gzip.push(strToU8(text)),
    Date.now(),
  );
  gzip.push(new Uint8Array(0), true);
  const blob = new Blob(chunks, { type: "application/gzip" });
  const storageId = await ctx.storage.store(blob);
  return await ctx.runMutation(internal.ops.backupData.record, {
    kind,
    storageId,
    bytes: blob.size,
    counts,
    franchises,
  });
}

/** A backup now, from Settings → Data. */
export const create = action({
  args: {},
  returns: v.id("backups"),
  handler: async (ctx) => {
    await requireOwnerAction(ctx);
    return await runBackup(ctx, "manual");
  },
});

/** The cron's step: a scheduled run shows up in Settings → Errors if it fails, a cron's would not. */
export const startNightly = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.ops.backupRun.nightly, {});
    return null;
  },
});

/** The nightly backup. */
export const nightly = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await runBackup(ctx, "scheduled");
    return null;
  },
});
