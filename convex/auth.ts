import type { OIDCConfig } from "@auth/core/providers";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, createAccount } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { TEST_OWNER_EMAIL, TEST_PROVIDER_ID, isOwnerEmail, testModeEnabled } from "./lib/owner";

type VercelProfile = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
};

/**
 * Sign in with Vercel as a standard OIDC provider (issuer and endpoints come from
 * https://vercel.com/.well-known/openid-configuration). The callback URL to register in the
 * Vercel app is `<CONVEX_SITE_URL>/api/auth/callback/vercel`.
 */
const Vercel: OIDCConfig<VercelProfile> = {
  id: "vercel",
  name: "Vercel",
  type: "oidc",
  issuer: "https://vercel.com",
  clientId: process.env.AUTH_VERCEL_ID,
  clientSecret: process.env.AUTH_VERCEL_SECRET,
  authorization: { params: { scope: "openid email profile" } },
  checks: ["pkce", "state", "nonce"],
  profile: (profile) => ({
    id: profile.sub,
    name: profile.name ?? profile.preferred_username,
    email: profile.email,
    image: profile.picture,
  }),
};

/** Local-only sign-in for development and Playwright. Refuses unless AUTH_TEST_MODE is on. */
const TestOwner = ConvexCredentials({
  id: TEST_PROVIDER_ID,
  authorize: async (_credentials, ctx) => {
    if (!testModeEnabled()) throw new ConvexError({ code: "forbidden", message: "Test sign-in is disabled" });
    const { user } = await createAccount(ctx, {
      provider: TEST_PROVIDER_ID,
      account: { id: "owner" },
      profile: { name: "Test Owner", email: TEST_OWNER_EMAIL },
    });
    return { userId: user._id };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Vercel, TestOwner],
  callbacks: {
    // The owner allowlist is enforced here, before any account or session exists.
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (!isOwnerEmail(profile.email)) {
        throw new ConvexError({
          code: "forbidden",
          message: "This account is not allowed to use FranchiseTracker",
        });
      }
      const fields = {
        name: typeof profile.name === "string" ? profile.name : undefined,
        email: profile.email,
        image: typeof profile.image === "string" ? profile.image : undefined,
      };
      if (existingUserId) {
        await ctx.db.patch(existingUserId, fields);
        return existingUserId;
      }
      return await ctx.db.insert("users", fields);
    },
  },
});
