#!/usr/bin/env node
/**
 * The launch check "a fresh clone, npm install, npx convex dev and franchise setup reproduce a
 * working app" (docs/SPRINTS.md, Sprint 9; docs/LAUNCH.md), automated: clones the committed
 * branch into a temporary folder, installs, starts a brand-new local backend and walks through
 * first-run setup in Chromium. Needs port 3210 free (stop `npm run dev` first).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const run = (cmd, args, cwd, env = {}) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

const busy = await new Promise((resolve) => {
  const socket = createConnection({ port: 3210, host: "127.0.0.1" });
  socket.once("connect", () => (socket.destroy(), resolve(true)));
  socket.once("error", () => resolve(false));
});
if (busy) {
  console.error("Port 3210 is in use: stop the local backend (npm run dev) and run this again.");
  process.exit(1);
}

const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root }).toString().trim();
const dir = mkdtempSync(join(tmpdir(), "franchisetracker-fresh-"));
let failed = false;
try {
  console.log(`Cloning ${branch} into ${dir}`);
  run("git", ["clone", "--quiet", "--branch", branch, root, dir], root);
  run("npm", ["ci", "--no-audit", "--no-fund"], dir);
  // Pushes the functions to a new local deployment, sets up test sign-in and seeds the teams.
  run("npm", ["run", "use:local"], dir);
  // `use:local` leaves its backend running; Playwright starts its own.
  try {
    run("bash", ["-c", "lsof -tiTCP:3210 -sTCP:LISTEN | xargs kill 2>/dev/null; sleep 1"], dir);
  } catch {
    // Nothing was left running.
  }
  run("npx", ["playwright", "test", "-c", join(root, "scripts/fresh-clone/playwright.config.ts")], root, {
    FRESH_CLONE_DIR: dir,
  });
  console.log("Fresh clone check passed.");
} catch {
  failed = true;
  console.error(`Fresh clone check failed; the clone is kept in ${dir} for a look.`);
} finally {
  if (!failed) rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
