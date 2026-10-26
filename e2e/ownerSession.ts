import type { BrowserContextOptions } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { loadEnv } from "vite";
import { TEST_PROVIDER_ID } from "../convex/lib/owner";

type StorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;
type Tokens = { token: string; refreshToken: string };

/** The backend the e2e build talks to, read the way Vite reads it for `--mode e2e`. */
const CONVEX_URL = loadEnv("e2e", process.cwd()).VITE_CONVEX_URL ?? "http://127.0.0.1:3210";

const signIn = makeFunctionReference<"action", { provider: string }, { tokens?: Tokens | null }>(
  "auth:signIn",
);

/** Convex Auth's localStorage keys: the key name plus the client URL with non-alphanumerics stripped. */
const storageKey = (key: string) => `${key}_${CONVEX_URL.replace(/[^a-zA-Z0-9]/g, "")}`;

/**
 * A fresh test-owner session, as browser storage the app reads on load. Signing in through
 * the action skips a page load and a click per test. Each test needs its own session: the
 * client rotates the refresh token on every load, and Convex Auth revokes a session whose old
 * refresh token is replayed after 10 s, so one saved session shared across tests signs them out.
 */
export async function ownerSession(origin: string): Promise<StorageState> {
  const { tokens } = await new ConvexHttpClient(CONVEX_URL).action(signIn, { provider: TEST_PROVIDER_ID });
  if (!tokens) throw new Error("Test sign-in returned no tokens: is AUTH_TEST_MODE on for the e2e backend?");
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: storageKey("__convexAuthJWT"), value: tokens.token },
          { name: storageKey("__convexAuthRefreshToken"), value: tokens.refreshToken },
        ],
      },
    ],
  };
}
