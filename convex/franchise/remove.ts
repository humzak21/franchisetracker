/**
 * Deleting a franchise (Settings → Franchises), for one that is no longer wanted or a restore
 * that went wrong. Only an inactive franchise, confirmed by typing its name. Its rows go in the
 * background a page at a time, table by table, so each step stays well inside a mutation's limits.
 */
import { v } from "convex/values";
import { BACKUP_TABLES } from "../../shared/ops/backup";
import { internal } from "../_generated/api";
import { internalMutation, mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { literals } from "../lib/validators";

/**
 * Every table holding a franchise's rows, the franchise itself last. Shortcut tokens stay: they
 * belong to the owner, not to the franchise that was active when they were made.
 */
const SWEEP_TABLES = [
  ...BACKUP_TABLES.filter((t) => t !== "franchises"),
  "uploads",
  "extractions",
  "corrections",
] as const;
type SweepTable = (typeof SWEEP_TABLES)[number];
// The spread loses the tuple's non-empty type that `literals` wants; the list above is never empty.
const vSweepTable = literals(SWEEP_TABLES as unknown as readonly [SweepTable, ...SweepTable[]]);

/** Rows read per step. */
const PAGE = 200;

export const remove = mutation({
  args: { franchiseId: v.id("franchises"), confirmName: v.string() },
  returns: v.null(),
  handler: async (ctx, { franchiseId, confirmName }) => {
    await requireOwner(ctx);
    const franchise = must(await ctx.db.get("franchises", franchiseId), "Franchise");
    if (franchise.isActive) throw invalid("Switch to another franchise before deleting this one");
    if (confirmName.trim() !== franchise.name) throw invalid("Type the franchise's name to confirm");
    if (franchise.deletingAt !== undefined) return null;
    await ctx.db.patch("franchises", franchiseId, { deletingAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.franchise.remove.sweep, {
      franchiseId,
      table: SWEEP_TABLES[0],
      cursor: null,
    });
    return null;
  },
});

/**
 * One page of one table: deletes the franchise's rows on it (and an upload's screenshot), then
 * schedules the next page, the next table, or finally the franchise itself. Tables are read
 * page by page in creation order because several have no index starting with the franchise.
 */
export const sweep = internalMutation({
  args: {
    franchiseId: v.id("franchises"),
    table: vSweepTable,
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { franchiseId, table, cursor }) => {
    const page = await ctx.db.query(table).paginate({ numItems: PAGE, cursor });
    for (const row of page.page) {
      if (row.franchiseId !== franchiseId) continue;
      if (table === "uploads" && "storageId" in row) await ctx.storage.delete(row.storageId);
      await ctx.db.delete(table, row._id);
    }
    const next = page.isDone ? SWEEP_TABLES[SWEEP_TABLES.indexOf(table) + 1] : table;
    if (next === undefined) {
      await ctx.db.delete("franchises", franchiseId);
      return null;
    }
    await ctx.scheduler.runAfter(0, internal.franchise.remove.sweep, {
      franchiseId,
      table: next,
      cursor: page.isDone ? null : page.continueCursor,
    });
    return null;
  },
});
