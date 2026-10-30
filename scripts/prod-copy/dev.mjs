#!/usr/bin/env node
/**
 * `npm run dev:prod-copy`: this checkout's copy, the way `npm run dev` runs the sample data: the
 * backend, `convex dev` pushing code changes, and Vite. Sign in with the test owner button.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanEnv, convexBin, copyDir, copyEnvFile, listening, ports, root, startBackend } from "./lib.mjs";

if (!existsSync(copyEnvFile)) {
  console.error("No copy in this checkout yet: run npm run use:prod-copy first.");
  process.exit(1);
}
if (await listening(ports.cloud)) {
  console.error(`Port ${ports.cloud} is in use: the copy is already running.`);
  process.exit(1);
}

const backend = await startBackend(readFileSync(join(copyDir, "instance-secret"), "utf8"));
const children = [
  backend,
  spawn(convexBin, ["dev", "--typecheck", "disable", "--env-file", copyEnvFile], {
    cwd: copyDir,
    stdio: ["ignore", "inherit", "inherit"],
    env: cleanEnv(),
  }),
  spawn(
    join(root, "node_modules", ".bin", "vite"),
    ["--mode", "prod-copy", "--port", `${ports.web}`, "--strictPort"],
    {
      cwd: root,
      stdio: ["ignore", "inherit", "inherit"],
      env: cleanEnv(),
    },
  ),
];

const stop = (code) => {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
};
process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
for (const child of children) child.once("exit", () => stop(1));
