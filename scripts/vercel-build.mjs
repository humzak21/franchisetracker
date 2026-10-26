#!/usr/bin/env node
/**
 * Vercel build entry (vercel.json `buildCommand`).
 *
 * - Production (`VERCEL_ENV=production`): deploys Convex with CONVEX_DEPLOY_KEY, then builds the
 *   front end against the production URL. A missing key fails the build loudly.
 * - Preview with a Convex preview deploy key: same, against that preview deployment.
 * - Preview without a key: skips Convex entirely and builds the front end in `preview` mode,
 *   which points at the shared cloud dev deployment (`.env.preview`). Such previews show the
 *   sign-in screen; they exist to check the UI builds, not to use the app.
 */
import { execFileSync } from "node:child_process";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const env = process.env.VERCEL_ENV ?? "development";
const hasKey = Boolean(process.env.CONVEX_DEPLOY_KEY);

if (env === "production" && !hasKey) {
  console.error(
    "CONVEX_DEPLOY_KEY is not set for Production. See docs/AUTH-SETUP.md and the deploy key steps.",
  );
  process.exit(1);
}

if (hasKey) {
  run("npx", ["convex", "deploy", "--cmd", "npm run build", "--cmd-url-env-var-name", "VITE_CONVEX_URL"]);
} else {
  console.log(`No CONVEX_DEPLOY_KEY on ${env}: building the front end against the cloud dev deployment.`);
  run("npx", ["tsc", "-b"]);
  run("npx", ["vite", "build", "--mode", "preview"]);
}
