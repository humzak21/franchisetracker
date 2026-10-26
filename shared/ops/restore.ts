/**
 * Writing a backup from pages of rows, and restoring one as new franchises, over injected reads
 * and writes so the order and id bookkeeping are tested without a deployment. The backup action
 * (`convex/ops/backupRun.ts`) reads through internal queries; the restore runs in the browser
 * (Settings → Data) and writes through the owner's `convex/ops/restoreData.ts` mutations.
 */
import {
  BACKUP_TABLES,
  BACKUP_VERSION,
  prepareForRestore,
  remapDoc,
  type BackupFile,
  type BackupTable,
} from "./backup";

type Row = { _id: string } & Record<string, unknown>;
type Team = { _id: string; abbr: string };

/** Rows written per mutation: well inside a transaction's write limits. */
export const RESTORE_BATCH = 200;

export type BackupReader = {
  page(
    table: BackupTable,
    cursor: string | null,
  ): Promise<{ page: Row[]; isDone: boolean; continueCursor: string }>;
  teams(): Promise<Team[]>;
};

/**
 * Writes a backup file as JSON text a page at a time (`emit` receives the pieces in order), so
 * the caller can compress it as it goes without ever holding the whole file in memory.
 */
export async function writeBackup(
  read: BackupReader,
  emit: (text: string) => void,
  now: number,
): Promise<{ counts: Record<string, number>; franchises: string[] }> {
  const counts: Record<string, number> = {};
  const franchises: string[] = [];
  emit(
    `{"version":${BACKUP_VERSION},"createdAt":${now},"teams":${JSON.stringify(await read.teams())},"tables":{`,
  );
  for (const [index, table] of BACKUP_TABLES.entries()) {
    emit(`${index > 0 ? "," : ""}${JSON.stringify(table)}:[`);
    let count = 0;
    let cursor: string | null = null;
    for (;;) {
      const result = await read.page(table, cursor);
      if (result.page.length > 0) {
        emit((count > 0 ? "," : "") + result.page.map((row) => JSON.stringify(row)).join(","));
        count += result.page.length;
        if (table === "franchises") franchises.push(...result.page.map((row) => String(row.name)));
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    counts[table] = count;
    emit("]");
  }
  emit("}}");
  return { counts, franchises };
}

export type RestoreWriter = {
  teams(): Promise<Team[]>;
  insert(table: BackupTable, rows: Record<string, unknown>[]): Promise<string[]>;
  patch(table: BackupTable, patches: { id: string; fields: Record<string, unknown> }[]): Promise<void>;
};

/** Checks the shape of a parsed backup file before anything is written. */
export function parseBackup(value: unknown): BackupFile {
  const file = value as Partial<BackupFile> | null;
  if (!file || typeof file !== "object" || file.version !== BACKUP_VERSION) {
    throw new Error("Not a FranchiseTracker backup (or from a newer version)");
  }
  if (!Array.isArray(file.teams) || typeof file.tables !== "object" || file.tables === null) {
    throw new Error("The backup file is incomplete");
  }
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(file.tables[table])) throw new Error(`The backup has no ${table}`);
  }
  return file as BackupFile;
}

/**
 * Restores every franchise in a backup as new, inactive franchises labelled with `label`; the
 * existing data is never touched. Tables go in reference order; references to rows inserted later
 * are patched at the end. Returns the restored franchises' names and the rows written.
 */
export async function restoreBackup(
  file: BackupFile,
  write: RestoreWriter,
  label: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ franchises: string[]; rows: number }> {
  const map = new Map<string, string>();
  const current = new Map((await write.teams()).map((t) => [t.abbr, t._id]));
  for (const team of file.teams) {
    const id = current.get(team.abbr);
    if (!id) throw new Error(`Team ${team.abbr} is missing; seed the teams first`);
    map.set(team._id, id);
  }
  const pending = new Set(BACKUP_TABLES.flatMap((t) => file.tables[t].map((r) => r._id)));
  const deferred: { table: BackupTable; id: string; fields: Row }[] = [];
  const total = pending.size;
  let rows = 0;

  for (const table of BACKUP_TABLES) {
    const source = file.tables[table];
    for (let i = 0; i < source.length; i += RESTORE_BATCH) {
      const batch = source.slice(i, i + RESTORE_BATCH).map((row) => prepareForRestore(table, row, label));
      const prepared = batch.map((row) => remapDoc(row, map, pending));
      const ids = await write.insert(
        table,
        prepared.map((p) => p.doc),
      );
      batch.forEach((row, k) => {
        const id = ids[k];
        if (id === undefined) throw new Error(`Restoring ${table} returned too few ids`);
        map.set(row._id, id);
        pending.delete(row._id);
        const later = prepared[k]?.deferred ?? [];
        if (later.length > 0) {
          deferred.push({
            table,
            id,
            fields: { _id: row._id, ...Object.fromEntries(later.map((f) => [f, row[f]])) },
          });
        }
      });
      rows += batch.length;
      onProgress?.(rows, total);
    }
  }

  for (const table of BACKUP_TABLES) {
    const patches = deferred
      .filter((d) => d.table === table)
      .map((d) => ({ id: d.id, fields: remapDoc(d.fields, map, new Set()).doc }));
    for (let i = 0; i < patches.length; i += RESTORE_BATCH) {
      await write.patch(table, patches.slice(i, i + RESTORE_BATCH));
    }
  }

  return {
    franchises: file.tables.franchises.map((f) => String(prepareForRestore("franchises", f, label).name)),
    rows,
  };
}
