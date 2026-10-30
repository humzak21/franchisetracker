#!/usr/bin/env node
/**
 * Playwright's backend (playwright.config.ts `webServer`). Runs the local Convex backend as one
 * long-lived process, configures test auth and seeds against it, and only then opens a tiny
 * readiness port. Playwright waits on that port, so tests never start while setup is still
 * restarting the backend (Playwright treats any open port as ready).
 *
 * Reuses a local backend that is already running (`npm run dev`) instead of starting another.
 */
import { execFileSync, spawn } from "node:child_process";
import { createServer, createConnection } from "node:net";

const BACKEND_PORT = 3210;
const READY_PORT = Number(process.env.E2E_READY_PORT ?? 3299);
const env = {
  ...process.env,
  CONVEX_AGENT_MODE: "anonymous",
  CONVEX_DEPLOYMENT: "anonymous:anonymous-agent",
  // Convex stops a query or mutation after 1 s of wall time, and on a Mac that is swapping even
  // `league/teams:list` can sit that long waiting for memory. CI keeps the real limit, so a query
  // that is actually slow still fails there.
  ...(process.env.CI ? {} : { DATABASE_UDF_USER_TIMEOUT_SECONDS: "15" }),
};
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", env });

/**
 * Waits for the records build the seed started: the records tests read its books, and a build
 * still running when the first tests start competes with them for the backend.
 */
async function waitForRecordBuild() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const out = execFileSync("npx", ["convex", "run", "stats/recordBuild:statusForSetup"], {
      env,
      encoding: "utf8",
    });
    if (/"status":\s*"done"/.test(out)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The records build did not finish within three minutes");
}

const listening = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });

/** Starts `convex dev` and resolves once its first push is live. */
function startBackend() {
  const child = spawn("npx", ["convex", "dev", "--tail-logs", "disable"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGTERM", () => (stop(), process.exit(0)));
  process.once("SIGINT", () => (stop(), process.exit(0)));
  return new Promise((resolve, reject) => {
    // The CLI reports progress on stderr; watch both streams.
    const watch = (stream, out) =>
      stream.on("data", (chunk) => {
        out.write(chunk);
        if (/Convex functions ready/.test(String(chunk))) resolve(child);
      });
    watch(child.stdout, process.stdout);
    watch(child.stderr, process.stderr);
    child.once("exit", (code) => reject(new Error(`convex dev exited early (${code})`)));
  });
}

if (await listening(BACKEND_PORT)) {
  // Its own `convex dev` keeps pushing code changes, so only setup and seeding run here.
  console.log("Reusing the local backend already running on port 3210.");
} else {
  await startBackend();
}
run("node", ["scripts/local-auth-env.mjs"]);
run("npx", ["convex", "run", "league/seed:seedTeams"]);
run("npx", ["convex", "run", "dev/fixtures:seedFixtures"]);
run("npx", ["convex", "run", "stats/recordBuild:start"]);
await waitForRecordBuild();

createServer((socket) => socket.end()).listen(READY_PORT, "127.0.0.1", () => {
  console.log(`E2E backend ready (readiness port ${READY_PORT}).`);
});
