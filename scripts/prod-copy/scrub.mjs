/**
 * Turns a raw Convex export into a snapshot that is safe to keep: scrubbed tables and unclassified
 * ones are removed whole, unfinished jobs are settled, and the result is scanned before it is
 * zipped. The scan failing stops the snapshot, because `snapshot.mjs` deletes the raw export either way.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BACKUP_TABLES, NOT_BACKED_UP } from "../../shared/ops/backup.ts";
import {
  SCRUBBED_TABLES,
  SNAPSHOT_VERSION,
  dropStorageRows,
  findLeaks,
  keptTables,
  settleDocuments,
  storageIds,
} from "../../shared/ops/prodCopy.ts";

const kept = keptTables([...BACKUP_TABLES, ...Object.keys(NOT_BACKED_UP)]);
const SYSTEM = new Set(["_tables", "_storage", "_components"]);

function dataFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "_storage" ? [] : dataFiles(path);
    return name.endsWith(".jsonl") ? [path] : [];
  });
}

/** Rate limit state belongs to the tokens that are gone, and a component holds nothing else here. */
function clearComponentRows(dir) {
  for (const path of dataFiles(join(dir, "_components"))) {
    if (path.endsWith("documents.jsonl") && !path.includes("/_tables/")) writeFileSync(path, "");
  }
}

function dropBackupFiles(dir) {
  const backups = join(dir, "backups", "documents.jsonl");
  const storage = join(dir, "_storage", "documents.jsonl");
  if (!existsSync(backups) || !existsSync(storage)) return;
  const ids = new Set(storageIds(readFileSync(backups, "utf8")));
  writeFileSync(storage, dropStorageRows(readFileSync(storage, "utf8"), ids));
  for (const name of readdirSync(join(dir, "_storage"))) {
    if (ids.has(name.split(".")[0])) rmSync(join(dir, "_storage", name));
  }
}

function assertNoLeaks(dir) {
  const leaks = dataFiles(dir).flatMap((path) =>
    findLeaks(readFileSync(path, "utf8")).map((label) => `${relative(dir, path)}: ${label}`),
  );
  if (leaks.length > 0) throw new Error(`Snapshot refused, still contains:\n  ${leaks.join("\n  ")}`);
}

/** Writes `snapshot.zip` and `manifest.json` into `outDir` and returns the manifest. */
export function scrubExport(rawZip, workDir, outDir) {
  const dir = join(workDir, "unpacked");
  mkdirSync(dir);
  execFileSync("unzip", ["-q", rawZip, "-d", dir]);

  dropBackupFiles(dir);
  const rows = {};
  const unclassified = [];
  for (const table of readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory())) {
    if (SYSTEM.has(table)) continue;
    if (!kept.has(table)) {
      rmSync(join(dir, table), { recursive: true });
      if (!(table in SCRUBBED_TABLES)) unclassified.push(table);
      continue;
    }
    const path = join(dir, table, "documents.jsonl");
    const settled = settleDocuments(table, readFileSync(path, "utf8"));
    writeFileSync(path, settled);
    rows[table] = settled.split("\n").filter(Boolean).length;
  }
  if (existsSync(join(dir, "_components"))) clearComponentRows(dir);
  assertNoLeaks(dir);

  // Stored, not deflated: most of the bytes are images, and `convex import` reads it once.
  execFileSync("zip", ["-q", "-r", "-D", "-0", join(outDir, "snapshot.zip"), "."], { cwd: dir });
  const manifest = {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    rows,
    scrubbed: Object.keys(SCRUBBED_TABLES),
    unclassified,
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
