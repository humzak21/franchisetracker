/**
 * The database side of backups (FEATURES.md 5.12, 8): pages of rows for the backup action in
 * `backupRun.ts`, recording finished backups with their retention, and the backups list.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { BACKUP_TABLES } from "../../shared/ops/backup";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { literals } from "../lib/validators";

/** Scheduled backups kept; manual ones stay until deleted. */
const KEEP_SCHEDULED = 14;
const MAX_LISTED = 50;

const vTable = literals(BACKUP_TABLES);
const vRow = v.record(v.string(), v.any());

/** One page of a table, every franchise's rows (a backup is the whole app's franchise data). */
export const page = internalQuery({
  args: { table: vTable, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(vRow),
  handler: async (ctx, { table, paginationOpts }) => {
    return await ctx.db.query(table).paginate(paginationOpts);
  },
});

/** Every team's id and abbreviation, written into the backup for the restore to match on. */
export const teams = internalQuery({
  args: {},
  returns: v.array(v.object({ _id: v.string(), abbr: v.string() })),
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").take(64);
    return teams.map((t) => ({ _id: t._id, abbr: t.abbr }));
  },
});

/** Records a finished backup and drops scheduled ones past the retention. */
export const record = internalMutation({
  args: {
    kind: v.union(v.literal("scheduled"), v.literal("manual")),
    storageId: v.id("_storage"),
    bytes: v.number(),
    counts: v.record(v.string(), v.number()),
    franchises: v.array(v.string()),
  },
  returns: v.id("backups"),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("backups", { ...args, createdAt: Date.now() });
    if (args.kind === "scheduled") {
      const scheduled = await ctx.db
        .query("backups")
        .withIndex("by_kind_and_createdAt", (q) => q.eq("kind", "scheduled"))
        .order("desc")
        .take(KEEP_SCHEDULED + 10);
      for (const old of scheduled.slice(KEEP_SCHEDULED)) await removeBackup(ctx, old._id, old.storageId);
    }
    return id;
  },
});

async function removeBackup(ctx: MutationCtx, id: Id<"backups">, storageId: Id<"_storage">) {
  await ctx.storage.delete(storageId);
  await ctx.db.delete("backups", id);
}

/** Backups newest first, manual and scheduled, each with a download link. */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("backups"),
      kind: v.union(v.literal("scheduled"), v.literal("manual")),
      bytes: v.number(),
      rows: v.number(),
      franchises: v.array(v.string()),
      createdAt: v.number(),
      url: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [manual, scheduled] = await Promise.all(
      (["manual", "scheduled"] as const).map((kind) =>
        ctx.db
          .query("backups")
          .withIndex("by_kind_and_createdAt", (q) => q.eq("kind", kind))
          .order("desc")
          .take(MAX_LISTED),
      ),
    );
    const backups = [...(manual ?? []), ...(scheduled ?? [])].sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(
      backups.map(async (b) => ({
        _id: b._id,
        kind: b.kind,
        bytes: b.bytes,
        rows: Object.values(b.counts).reduce((sum, n) => sum + n, 0),
        franchises: b.franchises,
        createdAt: b.createdAt,
        url: await ctx.storage.getUrl(b.storageId),
      })),
    );
  },
});

export const remove = mutation({
  args: { backupId: v.id("backups") },
  returns: v.null(),
  handler: async (ctx, { backupId }) => {
    await requireOwner(ctx);
    const backup = await ctx.db.get("backups", backupId);
    if (backup) await removeBackup(ctx, backup._id, backup.storageId);
    return null;
  },
});
