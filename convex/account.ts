import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import { testModeEnabled } from "./lib/owner";

/** Public on purpose: the sign-in screen needs to know which buttons to offer. */
export const authInfo = query({
  args: {},
  returns: v.object({ testSignIn: v.boolean() }),
  handler: async () => ({ testSignIn: testModeEnabled() }),
});

/** The signed-in owner, for the account section in Settings. */
export const me = query({
  args: {},
  returns: v.object({
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
    image: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const user = await requireOwner(ctx);
    return { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null };
  },
});
