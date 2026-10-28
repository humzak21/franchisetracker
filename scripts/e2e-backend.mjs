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
};
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", env });

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

createServer((socket) => socket.end()).listen(READY_PORT, "127.0.0.1", () => {
  console.log(`E2E backend ready (readiness port ${READY_PORT}).`);
});
