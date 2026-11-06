/**
 * A thin, typed layer over `madden-franchise`: opens a Madden franchise save (CAREER-* file),
 * reads a table's live rows as plain objects and follows the 32-bit references that link tables
 * (a player's game-stat rows, a game's team-stat caches, an array of scoring plays). Read only.
 */
import Franchise, { utilService, type FranchiseFileTable } from "madden-franchise";

export type Row = Record<string, unknown>;

/** A live row with its position in its table, which references point at. */
export type Located = { table: FranchiseFileTable; index: number; row: Row };

type OffsetEntry = { name: string; type: string };

const NULL_REF = /^0+$/;

/** A reference field holds a 32-character bit string; all zeros means none. */
export const isRef = (value: unknown): value is string =>
  typeof value === "string" && value.length === 32 && !NULL_REF.test(value);

export const num = (row: Row, field: string): number => {
  const value = row[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

export const str = (row: Row, field: string): string => {
  const value = row[field];
  return typeof value === "string" ? value : "";
};

export class SaveFile {
  private readonly loaded = new Map<number, Promise<void>>();

  private constructor(private readonly file: Franchise) {}

  static async open(path: string): Promise<SaveFile> {
    return new SaveFile(await Franchise.create(path));
  }

  get gameYear(): number {
    return this.file.gameYear;
  }

  get schemaVersion(): { major: number; minor: number } | null {
    const meta = this.file.schemaList?.meta;
    return meta ? { major: meta.major, minor: meta.minor } : null;
  }

  /** The table of this name with the most rows: Madden keeps one-row twins of some tables. */
  table(name: string): FranchiseFileTable {
    const candidates = (this.file.tables ?? []).filter((t) => t.name === name);
    const best = [...candidates].sort((a, b) => b.header.recordCapacity - a.header.recordCapacity)[0];
    if (!best) throw new Error(`No table named ${name} in this save`);
    return best;
  }

  /**
   * Reads a table's records once. `fields` limits what is decoded (the Player table has 380
   * columns); the first call for a table decides, later calls reuse it.
   */
  load(table: FranchiseFileTable, fields?: readonly string[]): Promise<void> {
    const id = table.header.tableId;
    let pending = this.loaded.get(id);
    if (!pending) {
      pending = table.readRecords(fields ? [...fields] : undefined).then(() => undefined);
      this.loaded.set(id, pending);
    }
    return pending;
  }

  /** The live rows of the table named `name`. */
  async rows(name: string, fields?: readonly string[]): Promise<Located[]> {
    const table = this.table(name);
    await this.load(table, fields);
    return table.records.flatMap((record, index) =>
      record.isEmpty ? [] : [{ table, index, row: this.rowOf(table, index) }],
    );
  }

  private rowOf(table: FranchiseFileTable, index: number): Row {
    const record = table.records[index];
    const entries = table.offsetTable as OffsetEntry[];
    const row: Row = {};
    if (!record) return row;
    for (const entry of entries) row[entry.name] = record.getValueByKey(entry.name) as unknown;
    return row;
  }

  /** Follows a reference to its row, or null for no reference or one into the game's static data. */
  async deref(value: unknown): Promise<Located | null> {
    if (!isRef(value)) return null;
    const { tableId, rowNumber } = utilService.getReferenceData(value);
    const table = this.file.getTableById(tableId);
    if (!table) return null;
    await this.load(table);
    const record = table.records[rowNumber];
    if (!record || record.isEmpty) return null;
    return { table, index: rowNumber, row: this.rowOf(table, rowNumber) };
  }

  /** The row index a reference points at, without reading it (to key rows by their game). */
  refIndex(value: unknown): number | null {
    return isRef(value) ? utilService.getReferenceData(value).rowNumber : null;
  }

  /** The references held in the array row a reference points at (`Player.GameStats` → its rows). */
  async refsIn(value: unknown): Promise<string[]> {
    const located = await this.deref(value);
    if (!located) return [];
    return Object.values(located.row).filter(isRef);
  }
}
