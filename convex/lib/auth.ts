/**
 * Auth plan (not implemented in Sprint 0; there is deliberately no auth.config.ts).
 *
 * The whole app is private and sits behind Sign in with Vercel (Sprint 1, before any
 * franchise data reaches production):
 * - `convex/auth.config.ts` registers Vercel as an OIDC provider so Convex validates the
 *   Vercel ID token; the issuer and audience come from the Vercel OAuth app.
 * - This module gains `requireOwner(ctx)`: reads `ctx.auth.getUserIdentity()`, rejects
 *   signed-out callers and any identity not on the owner allowlist (a Convex env var).
 *   Every public query, mutation and action calls it first.
 * - The Apple Shortcut HTTP endpoint is the one exception: a revocable bearer token,
 *   stored hashed in `ingestionTokens` and checked in `http.ts`.
 *
 * Until then all functions are open, which is acceptable only while the deployments hold
 * nothing but the seeded teams and empty seasons.
 */
export {};
