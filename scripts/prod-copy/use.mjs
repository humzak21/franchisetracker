#!/usr/bin/env node
/**
 * `npm run use:prod-copy`: replaces this checkout's copy with the latest snapshot
 * (docs/PROD-COPY.md). The copy has its own folder (`.convex/prod-copy`) and port, because the
 * CLI keeps one backend per folder: that one stays Playwright's, and `.env.local` is left alone.
 *
 * Runs the CLI from the copy's folder with its own env file, because `convex dev` run from the
 * repository rewrites the root `.env.local` when it talks to a backend it did not start.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROD_COPY_INSTANCE } from "../../shared/ops/prodCopy.ts";
import { convexEnv, ensureJwtKeys } from "../lib/convex-env.mjs";
import {
  backendBinary,
  cleanEnv,
  convexBin,
  copyDir,
  copyEnvFile,
  copyUrl,
  latestSnapshot,
  listening,
  ports,
  root,
  startBackend,
} from "./lib.mjs";

/** All a copy may have set. Anything else on it would have come from somewhere it should not. */
const ALLOWED_ENV = ["AUTH_TEST_MODE", "JWKS", "JWT_PRIVATE_KEY", "SITE_URL"];

const snapshot = latestSnapshot();
if (await listening(ports.cloud)) {
  console.error(`Port ${ports.cloud} is in use: stop npm run dev:prod-copy and run this again.`);
  process.exit(1);
}

const convex = (...args) =>
  execFileSync(convexBin, args, {
    cwd: copyDir,
    env: cleanEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

rmSync(copyDir, { recursive: true, force: true });
mkdirSync(copyDir, { recursive: true });
symlinkSync(join(root, "package.json"), join(copyDir, "package.json"));
symlinkSync(join(root, "node_modules"), join(copyDir, "node_modules"));
writeFileSync(join(copyDir, "convex.json"), `${JSON.stringify({ functions: "../../convex" })}\n`);

const instanceSecret = randomBytes(32).toString("hex");
const adminKey = execFileSync(
  backendBinary(),
  ["keygen", "admin-key", "--instance-name", PROD_COPY_INSTANCE, "--instance-secret", instanceSecret],
  { encoding: "utf8" },
).trim();
writeFileSync(join(copyDir, "instance-secret"), instanceSecret, { mode: 0o600 });
writeFileSync(copyEnvFile, `CONVEX_SELF_HOSTED_URL=${copyUrl}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`, {
  mode: 0o600,
});
writeFileSync(
  join(root, ".env.prod-copy.local"),
  `# Written by npm run use:prod-copy: the copy's local backend, for vite --mode prod-copy.\n` +
    `VITE_CONVEX_URL=${copyUrl}\nVITE_CONVEX_SITE_URL=http://127.0.0.1:${ports.site}\n`,
);

const backend = await startBackend(instanceSecret);
try {
  console.log(`Loading the ${snapshot.manifest.createdAt} snapshot into ${copyUrl}`);
  convex("dev", "--once", "--typecheck", "disable", "--tail-logs", "disable", "--env-file", copyEnvFile);

  const env = convexEnv(["--env-file", copyEnvFile], { cwd: copyDir, env: cleanEnv() });
  await ensureJwtKeys(env);
  env.set("SITE_URL", `http://localhost:${ports.web}`);
  env.set("AUTH_TEST_MODE", "true");

  convex("import", "--replace-all", "--yes", "--env-file", copyEnvFile, snapshot.zip);

  const stray = convex("env", "list", "--env-file", copyEnvFile)
    .split("\n")
    .map((line) => line.split("=")[0])
    .filter((name) => name && !ALLOWED_ENV.includes(name));
  if (stray.length > 0) throw new Error(`Unexpected env on the copy: ${stray.join(", ")}`);
  console.log(`Copy ready. Open it with: npm run dev:prod-copy (http://localhost:${ports.web})`);
} finally {
  backend.kill("SIGTERM");
}
