/**
 * The whole app is private (FEATURES.md 2). Every public query, mutation and action calls
 * `requireOwner` first, and every public action `requireOwnerAction`. The only unauthenticated
 * surfaces are Convex Auth's own sign-in routes, `account.authInfo` (which sign-in buttons to
 * show), and the token-checked, rate-limited Shortcut endpoint. `audit/convex.test.ts` enforces it.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
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

/**
 * Actions have no db, so the owner check runs as an internal query, which sees the caller's
 * identity. Re-checked on every call like `requireOwner`, so a removed owner's session stops working.
 */
export async function requireOwnerAction(ctx: ActionCtx): Promise<void> {
  if ((await ctx.auth.getUserIdentity()) === null) {
    throw new ConvexError({ code: "unauthenticated", message: "Sign in required" });
  }
  await ctx.runQuery(internal.account.assertOwner, {});
}
