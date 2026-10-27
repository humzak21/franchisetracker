/**
 * Deleting a franchise (Settings → Franchises), for one that is no longer wanted or a restore
 * that went wrong, confirmed by typing its name. Deleting the active one hands over to the
 * franchise used most recently before it, or to first-run setup when none is left. Its rows go in
 * the background a page at a time, table by table, so each step stays well inside a mutation's limits.
 */
import { v } from "convex/values";
import { BACKUP_TABLES } from "../../shared/ops/backup";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
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
  "manualDrafts",
] as const;
type SweepTable = (typeof SWEEP_TABLES)[number];
// The spread loses the tuple's non-empty type that `literals` wants; the list above is never empty.
const vSweepTable = literals(SWEEP_TABLES as unknown as readonly [SweepTable, ...SweepTable[]]);

/** Rows read per step. */
const PAGE = 200;
/** One owner keeps a handful of franchises. */
const MAX_FRANCHISES = 50;

/** The franchise to carry on with: the one left most recently, else the newest; null when none is left. */
async function successor(ctx: MutationCtx, removed: Doc<"franchises">): Promise<Doc<"franchises"> | null> {
  const others = (await ctx.db.query("franchises").order("desc").take(MAX_FRANCHISES)).filter(
    (f) => f._id !== removed._id && f.deletingAt === undefined,
  );
  // Newest first already, so a stable sort keeps that order among franchises never left.
  return others.sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0))[0] ?? null;
}

export const remove = mutation({
  args: { franchiseId: v.id("franchises"), confirmName: v.string() },
  returns: v.null(),
  handler: async (ctx, { franchiseId, confirmName }) => {
    await requireOwner(ctx);
    const franchise = must(await ctx.db.get("franchises", franchiseId), "Franchise");
    if (confirmName.trim() !== franchise.name) throw invalid("Type the franchise's name to confirm");
    if (franchise.deletingAt !== undefined) return null;
    await ctx.db.patch("franchises", franchiseId, { deletingAt: Date.now(), isActive: false });
    if (franchise.isActive) {
      const next = await successor(ctx, franchise);
      if (next) await ctx.db.patch("franchises", next._id, { isActive: true });
    }
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
