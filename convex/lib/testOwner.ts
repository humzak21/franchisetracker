/**
 * Test helpers for convex-test: identities shaped exactly like Convex Auth's
 * (`subject` = "<userId>|<sessionId>"). Type-only imports, so this module is inert when
 * pushed to a deployment.
 */
import type { TestConvex } from "convex-test";
import type schema from "../schema";

export const OWNER_EMAIL = "owner@example.com";

type T = TestConvex<typeof schema>;

async function identityFor(t: T, email: string) {
  const subject = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, name: email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3_600_000 });
    return `${userId}|${sessionId}`;
  });
  return t.withIdentity({ subject });
}

/** Configures the allowlist and returns an accessor signed in as the owner. */
export function asOwner(t: T) {
  process.env.OWNER_EMAILS = OWNER_EMAIL;
  return identityFor(t, OWNER_EMAIL);
}

/** A signed-in user who is not on the allowlist. */
export function asStranger(t: T) {
  process.env.OWNER_EMAILS = OWNER_EMAIL;
  return identityFor(t, "stranger@example.com");
}
