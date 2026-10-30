/**
 * The local copy of production (docs/PROD-COPY.md): what a Convex export may keep once it leaves
 * production. Everything here runs on the export before it is stored, so a secret that is
 * scrubbed never reaches the disk or a local backend.
 *
 * Plain TypeScript with no imports: `scripts/prod-copy` runs it through Node's type stripping.
 */

export const SNAPSHOT_VERSION = 1;

/** The copy's backend instance. `scripts/e2e-backend.mjs` refuses to run against this name. */
export const PROD_COPY_INSTANCE = "anonymous-prod-copy";

/** Tables a snapshot never keeps, and why. Anything not listed as kept is dropped too. */
export const SCRUBBED_TABLES = {
  users: "the real account; the local test owner signs in instead",
  authAccounts: "Vercel account links",
  authSessions: "live sessions",
  authRefreshTokens: "refresh tokens",
  authVerificationCodes: "sign-in codes",
  authVerifiers: "sign-in verifiers",
  authRateLimits: "sign-in rate limits",
  ingestionTokens: "Shortcut bearer tokens",
  errorReports: "production URLs, stacks and the owner's browser",
  backups: "gzipped copies that cannot be scanned; their files are dropped with them",
} as const;

const SCRUBBED = new Set<string>(Object.keys(SCRUBBED_TABLES));

/**
 * The tables a snapshot keeps, from the tables the backup already has to classify. `known` is
 * passed in so a table added to the backup lists is kept here without a second list to update.
 */
export function keptTables(known: readonly string[]): Set<string> {
  return new Set(known.filter((table) => !SCRUBBED.has(table)));
}

const INTERRUPTED = "Interrupted by a production snapshot; run it again in the copy.";

/**
 * Exports leave out scheduled functions, so a job caught mid-run never finishes in the copy.
 * Returns the row to keep, or null to drop it; a row nothing applies to comes back as it was.
 */
function settleInFlight(table: string, row: Record<string, unknown>): Record<string, unknown> | null {
  if (table === "historyImports" && row.status === "running") {
    return { ...row, status: "failed", error: INTERRUPTED };
  }
  if (table === "uploads" && row.status === "extracting") {
    const { extractionStartedAt: _run, ...rest } = row;
    return { ...rest, status: "failed", error: INTERRUPTED };
  }
  // No row means "never built", which the Records screen offers to build.
  if (table === "recordBuilds" && row.status === "running") return null;
  return row;
}

const SETTLED_TABLES = new Set(["historyImports", "uploads", "recordBuilds"]);

type ExactReviver = (key: string, value: unknown, context: { source: string }) => unknown;

/** Keeps each number's text: Convex imports `0.0` as a float and `0` as an integer. */
const keepNumberText: ExactReviver = (_key, value, { source }) =>
  typeof value === "number" ? (JSON as unknown as { rawJSON(text: string): unknown }).rawJSON(source) : value;

/** One kept table's `documents.jsonl` with its unfinished jobs settled. */
export function settleDocuments(table: string, jsonl: string): string {
  if (!SETTLED_TABLES.has(table)) return jsonl;
  return jsonl
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      const row = JSON.parse(line, keepNumberText as (key: string, value: unknown) => unknown) as Record<
        string,
        unknown
      >;
      const settled = settleInFlight(table, row);
      if (settled === null) return [];
      return [settled === row ? line : JSON.stringify(settled)];
    })
    .map((line) => `${line}\n`)
    .join("");
}

/** The storage ids a table's rows point at, to drop the files that go with scrubbed rows. */
export function storageIds(jsonl: string): string[] {
  return jsonl
    .split("\n")
    .filter(Boolean)
    .map((line) => (JSON.parse(line) as { storageId: string }).storageId);
}

/** `_storage/documents.jsonl` without the given files. */
export function dropStorageRows(jsonl: string, ids: ReadonlySet<string>): string {
  return jsonl
    .split("\n")
    .filter((line) => line && !ids.has((JSON.parse(line) as { _id: string })._id))
    .map((line) => `${line}\n`)
    .join("");
}

const LEAK_PATTERNS: readonly (readonly [label: string, pattern: RegExp])[] = [
  ["a Convex deployment URL", /[a-z0-9-]+\.convex\.(?:cloud|site)/i],
  ["a Vercel URL", /[a-z0-9-]+\.vercel\.(?:app|com)/i],
  ["an email address", /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
  ["an API key or bearer token", /\bsk-or-[\w-]{8,}|\bBearer\s+[\w.-]{16,}/],
  ["a signed token", /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}/],
];

/** What a stored file still contains that should never leave production, by label, never by value. */
export function findLeaks(text: string): string[] {
  return LEAK_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

const FIRST_PORT = 3310;
const SLOTS = 300;
const PORTS_PER_SLOT = 3;

/**
 * The copy's ports for a checkout, worked out from its path so each worktree keeps its own and
 * several can run at once. The range stays clear of the ports Playwright and `npm run dev` use
 * (3210, 3211, 3299, 5173, 5174), which is what keeps a running copy out of the tests' way.
 */
export function copyPorts(checkoutPath: string): { cloud: number; site: number; web: number } {
  let hash = 0x811c9dc5;
  for (const char of checkoutPath) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const cloud = FIRST_PORT + (hash % SLOTS) * PORTS_PER_SLOT;
  return { cloud, site: cloud + 1, web: cloud + 2 };
}
