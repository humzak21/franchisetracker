/**
 * Who may use this app. FranchiseTracker is private to one owner: the Vercel account(s)
 * listed in the `OWNER_EMAILS` env var. Fails closed: with no allowlist, nobody signs in.
 *
 * `AUTH_TEST_MODE=true` (set only on local deployments, never cloud) additionally admits
 * the fixed test owner so Playwright and local development can sign in without Vercel.
 */

export const TEST_PROVIDER_ID = "test";
export const TEST_OWNER_EMAIL = "test-owner@franchisetracker.local";

export function testModeEnabled(): boolean {
  return process.env.AUTH_TEST_MODE === "true";
}

function ownerEmails(): Set<string> {
  return new Set(
    (process.env.OWNER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True when this email belongs to the owner (or the test owner while test mode is on). */
export function isOwnerEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === TEST_OWNER_EMAIL) return testModeEnabled();
  return ownerEmails().has(normalized);
}
