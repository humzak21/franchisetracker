/**
 * The whole app is private (FEATURES.md 2). Every public query, mutation and action calls
 * `requireOwner` first. The only unauthenticated surfaces are Convex Auth's own sign-in
 * routes, `account.authInfo` (which sign-in buttons to show), and, from Sprint 2, the
 * token-checked Shortcut endpoint.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { isOwnerEmail } from "./owner";

export async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError({ code: "unauthenticated", message: "Sign in required" });
  const user = await ctx.db.get("users", userId);
  // Re-checked on every call so removing an email from OWNER_EMAILS locks it out immediately.
  if (user === null || !isOwnerEmail(user.email)) {
    throw new ConvexError({ code: "forbidden", message: "Not the owner" });
  }
  return user;
}

/** Actions have no db; they check identity and delegate data access to internal functions. */
export async function requireSignedIn(ctx: ActionCtx): Promise<void> {
  if ((await ctx.auth.getUserIdentity()) === null) {
    throw new ConvexError({ code: "unauthenticated", message: "Sign in required" });
  }
}
