/**
 * The writes of a restore (FEATURES.md 5.12). The browser reads the backup file and drives the
 * restore (`shared/ops/restore.ts`) a batch at a time, so a large file never has to fit in an
 * action's memory; these owner-only mutations insert and patch the rows. Every row is checked
 * against the schema on write.
 */
import { v } from "convex/values";
import { BACKUP_TABLES, type BackupTable } from "../../shared/ops/backup";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { literals } from "../lib/validators";

const vTable = literals(BACKUP_TABLES);
const vRow = v.record(v.string(), v.any());
/** Rows per call: matches the restore's batch size, well inside a mutation's write limits. */
const MAX_ROWS = 200;

// Rows arrive from a backup file and the schema validates each write, so the generic insert and
// patch only need a table name; the cast says so once, here.
type GenericWriter = {
  insert: (table: BackupTable, doc: Record<string, unknown>) => Promise<string>;
  patch: (table: BackupTable, id: string, fields: Record<string, unknown>) => Promise<void>;
};
const writer = (ctx: MutationCtx) => ctx.db as unknown as GenericWriter;

/** Every team's id and abbreviation: restored references find their team by abbreviation. */
export const teams = query({
  args: {},
  returns: v.array(v.object({ _id: v.string(), abbr: v.string() })),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const teams = await ctx.db.query("teams").take(64);
    return teams.map((t) => ({ _id: t._id, abbr: t.abbr }));
  },
});

/** Inserts a batch of restored rows, returning their new ids in order. */
export const insertRows = mutation({
  args: { table: vTable, rows: v.array(vRow) },
  returns: v.array(v.string()),
  handler: async (ctx, { table, rows }) => {
    await requireOwner(ctx);
    if (rows.length > MAX_ROWS) throw new Error(`At most ${MAX_ROWS} rows per batch`);
    const db = writer(ctx);
    const ids: string[] = [];
    for (const row of rows) ids.push(await db.insert(table, row));
    return ids;
  },
});

/** Fills in references that pointed at rows inserted later in the restore. */
export const patchRows = mutation({
  args: { table: vTable, patches: v.array(v.object({ id: v.string(), fields: vRow })) },
  returns: v.null(),
  handler: async (ctx, { table, patches }) => {
    await requireOwner(ctx);
    if (patches.length > MAX_ROWS) throw new Error(`At most ${MAX_ROWS} rows per batch`);
    const db = writer(ctx);
    for (const { id, fields } of patches) await db.patch(table, id, fields);
    return null;
  },
});
