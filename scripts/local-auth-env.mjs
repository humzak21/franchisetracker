#!/usr/bin/env node
/**
 * Configures Convex Auth on the LOCAL deployment: JWT signing keys (generated once and
 * kept), SITE_URL, and AUTH_TEST_MODE so the test owner can sign in without Vercel.
 *
 * Refuses to run against anything but a local deployment, so test sign-in can never be
 * switched on in the cloud. Usage: node scripts/local-auth-env.mjs
 */
import { readFileSync } from "node:fs";
import { convexEnv, ensureJwtKeys } from "./lib/convex-env.mjs";

const SITE_URL = "http://localhost:5173";

function selectedDeployment() {
  if (process.env.CONVEX_DEPLOYMENT) return process.env.CONVEX_DEPLOYMENT;
  try {
    return readFileSync(".env.local", "utf8").match(/^CONVEX_DEPLOYMENT=(\S+)/m)?.[1] ?? "";
  } catch {
    return "";
  }
}

const deployment = selectedDeployment();
if (!/^(anonymous|local):/.test(deployment)) {
  console.error(`Refusing to configure test auth on "${deployment || "unknown"}": local deployments only.`);
  process.exit(1);
}

const env = convexEnv();
if (await ensureJwtKeys(env)) console.log("Generated JWT signing keys for the local deployment.");
env.set("SITE_URL", SITE_URL);
env.set("AUTH_TEST_MODE", "true");
console.log(`Local auth ready on ${deployment}: test sign-in enabled, SITE_URL=${SITE_URL}.`);
