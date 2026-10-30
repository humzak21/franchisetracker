#!/usr/bin/env node
/**
 * `npm run snapshot:prod`: a read-only export of production, scrubbed and stored where every
 * checkout can load it (docs/PROD-COPY.md). `convex export` is the only command here that talks
 * to production. The raw export is deleted before this exits, whether or not the scrub passed.
 *
 * Uses the Convex CLI's own login. Run from an empty folder, so no `.env.local` can select anything.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { cleanEnv, convexBin, root, snapshotRoot } from "./lib.mjs";
import { scrubExport } from "./scrub.mjs";

/** Names the project; `--prod` then resolves to its default production deployment. */
const PROJECT_DEPLOYMENT = "dev:prestigious-iguana-83";

mkdirSync(snapshotRoot, { recursive: true, mode: 0o700 });
const incoming = mkdtempSync(join(snapshotRoot, ".incoming-"));
try {
  // The CLI insists on a package.json where it runs.
  symlinkSync(join(root, "package.json"), join(incoming, "package.json"));
  symlinkSync(join(root, "node_modules"), join(incoming, "node_modules"));
  const rawZip = join(incoming, "export.zip");
  console.log("Exporting the project's production deployment (read-only), with file storage.");
  execFileSync(convexBin, ["export", "--prod", "--include-file-storage", "--path", rawZip], {
    cwd: incoming,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...cleanEnv(), CONVEX_DEPLOYMENT: PROJECT_DEPLOYMENT },
  });

  const out = join(incoming, "out");
  mkdirSync(out);
  const manifest = scrubExport(rawZip, incoming, out);
  const dest = join(snapshotRoot, manifest.createdAt.replace(/[:.]/g, "-"));
  renameSync(out, dest);

  const total = Object.values(manifest.rows).reduce((sum, n) => sum + n, 0);
  console.log(`Snapshot stored: ${dest}\n${total} rows in ${Object.keys(manifest.rows).length} tables.`);
  if (manifest.unclassified.length > 0) {
    console.warn(`Left out, not classified in shared/ops/backup.ts: ${manifest.unclassified.join(", ")}`);
  }
} finally {
  rmSync(incoming, { recursive: true, force: true });
}
