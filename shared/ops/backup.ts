/**
 * The backup format and the pure half of restore (FEATURES.md 5.12, 8). A backup is every
 * franchise's rows as JSON; restore inserts them as new franchises, so it never overwrites.
 * Ids change on insert, so every reference is rewritten through a map of old id to new id.
 */

export const BACKUP_VERSION = 1;

/**
 * Franchise tables in restore order: a table comes after every table it references. The one
 * cycle (a transaction's picks point at the pick inventory, whose rows point back at the
 * transaction that acquired them) is broken by deferring the references (see `remapDoc`).
 */
export const BACKUP_TABLES = [
  "franchises",
  "seasons",
  "players",
  "games",
  "gameStatLines",
  "gameTeamStats",
  "standings",
  "leagueLeaders",
  "teamSeasonStats",
  "rosterEntries",
  "playerSnapshots",
  "seasonPlayerStats",
  "careerPlayerStats",
  "reportedSeasonStats",
  "records",
  "streaks",
  "milestones",
  "awards",
  "draftPicks",
  "transactions",
  "draftPickInventory",
  "transactionPlayers",
  "injuries",
  "draftBoard",
  "seasonReports",
  "hofEntries",
  "trophyEntries",
  "historyImports",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * Tables a backup leaves out, and why. The ingestion queue holds screenshots, which live in file
 * storage rather than the JSON; tokens are secrets and are reissued from Settings.
 */
export const NOT_BACKED_UP = {
  teams: "league reference data; restored references match teams by abbreviation",
  uploads: "screenshots in file storage, not the JSON",
  extractions: "belong to uploads",
  corrections: "belong to extractions",
  ingestionTokens: "secrets; generate a new token after a restore",
  errorReports: "about the app, not the franchise",
  backups: "the backups themselves",
} as const;

type Row = { _id: string } & Record<string, unknown>;

export type BackupFile = {
  version: number;
  createdAt: number;
  /** Every team's id and abbreviation, to point references at the right team on restore. */
  teams: { _id: string; abbr: string }[];
  tables: Record<BackupTable, Row[]>;
};

/** Ids are looked up in `map`; ids of rows the restore has not inserted yet are deferred. */
export type IdMap = { get(id: string): string | undefined };

const UNRESOLVED = Symbol("unresolved");

function remapValue(value: unknown, map: IdMap, pending: ReadonlySet<string>): unknown {
  if (typeof value === "string") {
    const mapped = map.get(value);
    if (mapped !== undefined) return mapped;
    return pending.has(value) ? UNRESOLVED : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => remapValue(v, map, pending)).filter((v) => v !== UNRESOLVED);
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      const remapped = remapValue(v, map, pending);
      if (remapped !== UNRESOLVED) out[key] = remapped;
    }
    return out;
  }
  return value;
}

function hasUnresolved(value: unknown, map: IdMap, pending: ReadonlySet<string>): boolean {
  if (typeof value === "string") return map.get(value) === undefined && pending.has(value);
  if (Array.isArray(value)) return value.some((v) => hasUnresolved(v, map, pending));
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((v) => hasUnresolved(v, map, pending));
  }
  return false;
}

/**
 * A row ready to insert: system fields dropped and every known id rewritten. References to rows
 * still `pending` (in the backup but not inserted yet) are left out, which the schema allows
 * because each is optional, and their top-level fields are returned in `deferred` to patch once
 * everything is in. Other strings pass through unchanged.
 */
export function remapDoc(
  row: Row,
  map: IdMap,
  pending: ReadonlySet<string>,
): { doc: Record<string, unknown>; deferred: string[] } {
  const doc: Record<string, unknown> = {};
  const deferred: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (key === "_id" || key === "_creationTime") continue;
    if (hasUnresolved(value, map, pending)) deferred.push(key);
    const remapped = remapValue(value, map, pending);
    if (remapped !== UNRESOLVED) doc[key] = remapped;
  }
  return { doc, deferred };
}

/** Per-table changes on restore: franchises arrive inactive and labelled; no import resumes. */
export function prepareForRestore(table: BackupTable, row: Row, label: string): Row {
  if (table === "franchises") return { ...row, name: `${String(row.name)} (${label})`, isActive: false };
  if (table === "historyImports" && row.status === "running") {
    return { ...row, status: "failed", error: "Interrupted by a backup; refresh the import from Settings." };
  }
  return row;
}
