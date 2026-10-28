/**
 * A list typed up in a spreadsheet, read into rows for review: columns are matched to the
 * target's fields by key or label ("Season", "year"), plus the player and team columns. Each row
 * lands accepted, as if typed in; anything the columns cannot fill stays blank for review.
 */
import { resolveTeamAbbr } from "../../domain/teams";
import { csvRecords } from "../../history/csv";
import { emptyRow } from "../manual";
import { readField } from "./engine";
import type { DraftRow, RowField, RowSpec, RowValue, RowsDraft } from "./types";

type Column = { kind: "name" } | { kind: "team" } | { kind: "field"; field: RowField };

const headerKey = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

const NAME_HEADERS = new Set(["player", "name", "playername"]);
const TEAM_HEADERS = new Set(["team", "tm"]);
/** Common spreadsheet headings for fields named otherwise (Pro Football Reference prints Rk). */
const ALIASES: Record<string, string> = { rk: "rank", yr: "year" };

function columnFor(header: string, spec: RowSpec, fields: readonly RowField[]): Column | null {
  const key = headerKey(header);
  if (spec.player && NAME_HEADERS.has(key)) return { kind: "name" };
  if (spec.rowTeam && TEAM_HEADERS.has(key)) return { kind: "team" };
  const wanted = ALIASES[key] ?? key;
  const field = fields.find((f) => headerKey(f.key) === wanted || headerKey(f.label) === wanted);
  return field ? { kind: "field", field } : null;
}

function cellValue(field: RowField, cell: string): RowValue {
  const trimmed = cell.trim();
  if (trimmed === "") return null;
  if (field.type === "int" || field.type === "number")
    return readField(field, Number(trimmed.replace(/,/g, "")));
  if (field.type === "bool") return ["yes", "y", "true", "1"].includes(trimmed.toLowerCase());
  return readField(field, trimmed);
}

export type CsvRows<P extends string> = { rows: DraftRow<P>[]; ignored: string[] };

/** New rows from the CSV text, and the column headings nothing matched. */
export function rowsFromCsv<P extends string>(text: string, spec: RowSpec, draft: RowsDraft<P>): CsvRows<P> {
  const [header, ...records] = [...csvRecords(text.replace(/^\uFEFF/, ""))];
  if (!header) return { rows: [], ignored: [] };
  const fields = spec.fields(draft);
  const columns = header.map((h) => columnFor(h, spec, fields));
  const rows: DraftRow<P>[] = [];
  for (const record of records) {
    if (record.every((cell) => cell.trim() === "")) continue;
    const cellOf = (kind: "name" | "team") => {
      const i = columns.findIndex((c) => c?.kind === kind);
      return i >= 0 ? record[i]?.trim() || null : null;
    };
    const team = cellOf("team");
    const row = emptyRow(
      spec,
      { ...draft, rows: [...draft.rows, ...rows] },
      { name: cellOf("name") ?? undefined, teamAbbr: team ? resolveTeamAbbr(team) : null },
    );
    columns.forEach((column, i) => {
      if (column?.kind === "field") row.values[column.field.key] = cellValue(column.field, record[i] ?? "");
    });
    rows.push(row);
  }
  return { rows, ignored: header.filter((_, i) => columns[i] === null) };
}
