import { describe, expect, test } from "vitest";
import { BACKUP_TABLES, type BackupTable } from "./backup";
import { parseBackup, restoreBackup, writeBackup, type BackupReader, type RestoreWriter } from "./restore";

type Row = { _id: string } & Record<string, unknown>;

/** A tiny franchise with the transaction ↔ pick inventory cycle in it. */
const SOURCE: Partial<Record<BackupTable, Row[]>> = {
  franchises: [{ _id: "f1", name: "Dynasty", userTeamId: "teamNE", isActive: true }],
  seasons: [{ _id: "s1", franchiseId: "f1", year: 2026 }],
  players: [{ _id: "p1", franchiseId: "f1", displayName: "Drake Maye" }],
  games: [
    { _id: "g1", franchiseId: "f1", seasonId: "s1", stars: [{ playerId: "p1" }], opponentTeamId: "teamBUF" },
  ],
  transactions: [
    { _id: "t1", franchiseId: "f1", seasonId: "s1", picksIn: [{ year: 2027, inventoryId: "i1" }] },
  ],
  draftPickInventory: [{ _id: "i1", franchiseId: "f1", acquiredTransactionId: "t1" }],
};

/** Serves SOURCE two rows a page, like the paginated backup query. */
const reader: BackupReader = {
  teams: async () => [
    { _id: "teamNE", abbr: "NE" },
    { _id: "teamBUF", abbr: "BUF" },
  ],
  page: async (table, cursor) => {
    const rows = SOURCE[table] ?? [];
    const start = Number(cursor ?? 0);
    return {
      page: rows.slice(start, start + 2),
      isDone: start + 2 >= rows.length,
      continueCursor: String(start + 2),
    };
  },
};

/** An in-memory database with fresh ids, for the restore to write into. */
function memoryWriter() {
  const db = new Map<string, Row & { table: BackupTable }>();
  let next = 0;
  const writer: RestoreWriter = {
    teams: async () => [
      { _id: "NE-now", abbr: "NE" },
      { _id: "BUF-now", abbr: "BUF" },
    ],
    insert: async (table, rows) =>
      rows.map((row) => {
        const id = `new${next++}`;
        db.set(id, { ...row, _id: id, table });
        return id;
      }),
    patch: async (_table, patches) => {
      for (const { id, fields } of patches) db.set(id, { ...db.get(id)!, ...fields });
    },
  };
  const rows = (table: BackupTable) => [...db.values()].filter((r) => r.table === table);
  return { writer, rows };
}

describe("backup round trip", () => {
  test("writes valid JSON a piece at a time, with counts and franchise names", async () => {
    const pieces: string[] = [];
    const { counts, franchises } = await writeBackup(reader, (text) => pieces.push(text), 123);
    expect(pieces.length).toBeGreaterThan(BACKUP_TABLES.length);
    const file = parseBackup(JSON.parse(pieces.join("")));
    expect(file.createdAt).toBe(123);
    expect(file.tables.games).toEqual(SOURCE.games);
    expect(counts).toMatchObject({ franchises: 1, games: 1, awards: 0 });
    expect(franchises).toEqual(["Dynasty"]);
  });

  test("restores as a new inactive franchise with every reference rewritten", async () => {
    const pieces: string[] = [];
    await writeBackup(reader, (text) => pieces.push(text), 1);
    const { writer, rows } = memoryWriter();
    const progress: number[] = [];
    const result = await restoreBackup(parseBackup(JSON.parse(pieces.join(""))), writer, "restored", (done) =>
      progress.push(done),
    );
    expect(result).toEqual({ franchises: ["Dynasty (restored)"], rows: 6 });
    expect(progress.at(-1)).toBe(6);

    const [franchise] = rows("franchises");
    const [season] = rows("seasons");
    const [player] = rows("players");
    const [game] = rows("games");
    const [transaction] = rows("transactions");
    const [inventory] = rows("draftPickInventory");
    expect(franchise).toMatchObject({ name: "Dynasty (restored)", isActive: false, userTeamId: "NE-now" });
    expect(season!.franchiseId).toBe(franchise!._id);
    expect(game).toMatchObject({
      seasonId: season!._id,
      opponentTeamId: "BUF-now",
      stars: [{ playerId: player!._id }],
    });
    // The cycle: both sides point at each other once the restore is done.
    expect(transaction!.picksIn).toEqual([{ year: 2027, inventoryId: inventory!._id }]);
    expect(inventory!.acquiredTransactionId).toBe(transaction!._id);
  });

  test("refuses files that are not backups", () => {
    expect(() => parseBackup({ hello: "world" })).toThrow(/Not a FranchiseTracker backup/);
    expect(() => parseBackup({ version: 1, teams: [], tables: {} })).toThrow(/has no franchises/);
  });
});
