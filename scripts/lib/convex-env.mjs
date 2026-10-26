/** Small wrappers over `npx convex env` for the auth setup scripts. */
import { execFileSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

/** `extra` carries flags such as `--prod` through to every call. */
export function convexEnv(extra = []) {
  const run = (...args) =>
    execFileSync("npx", ["convex", "env", ...args, ...extra], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
  const current = run("list");
  return {
    has: (name) => new RegExp(`^${name}=`, "m").test(current),
    set: (name, value) => run("set", `${name}=${value}`),
  };
}

/** Generates and stores the Convex Auth JWT signing keys once; existing keys are kept. */
export async function ensureJwtKeys(env) {
  if (env.has("JWKS") && env.has("JWT_PRIVATE_KEY")) return false;
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });
  env.set("JWT_PRIVATE_KEY", privateKey);
  env.set("JWKS", jwks);
  return true;
}
