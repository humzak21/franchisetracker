#!/usr/bin/env node
/**
 * Creates the Convex Auth JWT signing keys on a cloud deployment if it has none.
 * Never touches AUTH_TEST_MODE. Usage:
 *   npm run auth:keys            # the deployment .env.local selects (cloud dev)
 *   npm run auth:keys -- --prod  # production (asks Convex for your login)
 */
import { convexEnv, ensureJwtKeys } from "./lib/convex-env.mjs";

const extra = process.argv.slice(2).filter((arg) => arg === "--prod");
const created = await ensureJwtKeys(convexEnv(extra));
console.log(created ? "Created JWT_PRIVATE_KEY and JWKS." : "JWT keys already present; left unchanged.");
