/**
 * Auth plan (not implemented in Sprint 0; there is deliberately no auth.config.ts).
 *
 * FranchiseTracker is single-user. A later sprint adds:
 * - Convex Auth with the password provider for the web app (Mac and phone PWA),
 *   plus `convex/auth.config.ts`, `authTables`, and a thin `users` table.
 * - A revocable bearer token for the Apple Shortcut HTTP endpoint, stored hashed in
 *   `ingestionTokens` and checked in `http.ts`.
 *
 * At that point this module gains `requireUser(ctx)` and every public function
 * calls it. Until then all functions are open on the dev deployment only.
 */
export {};
