/**
 * Bearer tokens for the Apple Shortcut endpoint. Only a SHA-256 hash is stored; the token is
 * shown once when created. Revoking takes effect on the next request.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, mutation, query } from "../_generated/server";
import { requireOwner, requireSignedIn } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";

const MAX_TOKENS = 50;
const TOKEN_PREFIX = "ft_";

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return TOKEN_PREFIX + base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Random bytes need an action (mutations are deterministic); the owner check runs in `store`. */
export const create = action({
  args: { label: v.string() },
  returns: v.string(),
  handler: async (ctx, { label }) => {
    await requireSignedIn(ctx);
    const token = newToken();
    await ctx.runMutation(internal.ingestion.tokens.store, { tokenHash: await sha256Hex(token), label });
    return token;
  },
});

export const store = internalMutation({
  args: { tokenHash: v.string(), label: v.string() },
  returns: v.null(),
  handler: async (ctx, { tokenHash, label }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    await ctx.db.insert("ingestionTokens", {
      franchiseId: franchise._id,
      tokenHash,
      label: label.trim().slice(0, 40) || "Shortcut",
      createdAt: Date.now(),
    });
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("ingestionTokens"),
      label: v.string(),
      createdAt: v.number(),
      lastUsedAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const tokens = await ctx.db
      .query("ingestionTokens")
      .withIndex("by_franchiseId", (q) => q.eq("franchiseId", franchise._id))
      .order("desc")
      .take(MAX_TOKENS);
    return tokens
      .filter((t) => t.revokedAt === undefined)
      .map((t) => ({
        _id: t._id,
        label: t.label ?? "Shortcut",
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt ?? null,
      }));
  },
});

export const revoke = mutation({
  args: { tokenId: v.id("ingestionTokens") },
  returns: v.null(),
  handler: async (ctx, { tokenId }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("ingestionTokens", tokenId), "Token");
    await ctx.db.patch("ingestionTokens", tokenId, { revokedAt: Date.now() });
    return null;
  },
});

/** Checks a presented token's hash; records the use. Returns whether it is valid. */
export const verify = internalMutation({
  args: { tokenHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { tokenHash }) => {
    const token = await ctx.db
      .query("ingestionTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!token || token.revokedAt !== undefined) return false;
    await ctx.db.patch("ingestionTokens", token._id, { lastUsedAt: Date.now() });
    return true;
  },
});
