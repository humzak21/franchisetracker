/** What the production copy's scripts share: where things live and how its backend starts. */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { createServer, request } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { PROD_COPY_INSTANCE, SNAPSHOT_VERSION, copyPorts } from "../../shared/ops/prodCopy.ts";

export const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
export const ports = copyPorts(root);
export const copyUrl = `http://127.0.0.1:${ports.cloud}`;
export const copyDir = join(root, ".convex", "prod-copy");
export const copyEnvFile = join(copyDir, "env");
export const convexBin = join(root, "node_modules", ".bin", "convex");

/** Shared by every checkout, and outside all of them, so no repository can ever track it. */
export const snapshotRoot = join(homedir(), ".franchisetracker", "prod-snapshots");

/** The environment without any Convex selection, so nothing a shell exported can pick a target. */
export function cleanEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("CONVEX_")));
}

export function listening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

/** The newest stored snapshot; folders are named by time, and a finished one has a manifest. */
export function latestSnapshot() {
  const names = existsSync(snapshotRoot) ? readdirSync(snapshotRoot).filter((n) => !n.startsWith(".")) : [];
  const dir = names
    .sort()
    .reverse()
    .map((name) => join(snapshotRoot, name))
    .find((path) => existsSync(join(path, "manifest.json")));
  if (dir === undefined) {
    throw new Error(`No snapshot in ${snapshotRoot}. Take one with: npm run snapshot:prod`);
  }
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  if (manifest.version !== SNAPSHOT_VERSION) {
    throw new Error(
      `${dir} is format ${manifest.version}, not ${SNAPSHOT_VERSION}: run npm run snapshot:prod`,
    );
  }
  return { zip: join(dir, "snapshot.zip"), manifest };
}

/** The newest backend the Convex CLI has downloaded, the one `convex dev` would run. */
export function backendBinary() {
  const dir = join(homedir(), ".cache", "convex", "binaries");
  const versions = existsSync(dir) ? readdirSync(dir).sort().reverse() : [];
  const path = versions.map((v) => join(dir, v, "convex-local-backend")).find(existsSync);
  if (path === undefined) throw new Error("No Convex backend downloaded yet: run npm run use:local once.");
  return path;
}

/**
 * The backend's only way out. Every action's `fetch` goes through this, and so does the backend's
 * own check of its sign-in keys, so it forwards requests for the copy's own site and refuses the
 * rest. With no gate listening, a fetch fails outright, so a leftover backend stays shut in too.
 */
function startEgressGate() {
  const ownSite = `http://127.0.0.1:${ports.site}/`;
  const gate = createServer((req, res) => {
    if (!req.url.startsWith(ownSite)) return res.writeHead(403).end("Blocked by the production copy");
    const upstream = request(req.url, { method: req.method, headers: req.headers }, (answer) => {
      res.writeHead(answer.statusCode, answer.headers);
      answer.pipe(res);
    });
    upstream.once("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  });
  gate.on("connect", (_req, socket) => socket.end("HTTP/1.1 403 Forbidden\r\n\r\n"));
  return new Promise((resolve) => gate.listen(0, "127.0.0.1", () => resolve(gate)));
}

/**
 * Starts the copy's backend directly instead of through `convex dev`, which offers no way to set
 * these flags: it binds to loopback rather than every interface, and has only the gate as a way out.
 */
export async function startBackend(instanceSecret) {
  mkdirSync(copyDir, { recursive: true });
  const gate = await startEgressGate();
  const child = spawn(
    backendBinary(),
    [
      "--interface",
      "127.0.0.1",
      "--port",
      String(ports.cloud),
      "--site-proxy-port",
      String(ports.site),
      "--instance-name",
      PROD_COPY_INSTANCE,
      "--instance-secret",
      instanceSecret,
      "--local-storage",
      join(copyDir, "convex_local_storage"),
      "--convex-http-proxy",
      `http://127.0.0.1:${gate.address().port}`,
      "--disable-beacon",
      join(copyDir, "convex_local_backend.sqlite3"),
    ],
    { stdio: "ignore", env: cleanEnv() },
  );
  child.once("exit", () => (gate.close(), gate.closeAllConnections()));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const name = await fetch(`${copyUrl}/instance_name`).then(
      (res) => res.text(),
      () => null,
    );
    if (name === PROD_COPY_INSTANCE) return child;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill("SIGTERM");
  throw new Error(`The copy's backend did not start on ${copyUrl}`);
}
