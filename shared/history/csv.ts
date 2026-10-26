/**
 * A small RFC 4180 CSV reader for the nflverse files: quoted fields may hold commas, doubled
 * quotes and line breaks. Rows come out keyed by header, holding only the columns asked for,
 * so a 7 MB file never becomes 40 columns of objects.
 */

/** Every record in the text as an array of raw field strings, header included. */
export function* csvRecords(text: string): Generator<string[]> {
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.length > 1 || record[0] !== "") yield record;
      record = [];
    } else field += ch;
  }
  record.push(field);
  if (record.length > 1 || record[0] !== "") yield record;
}

export type CsvRow<C extends string> = Record<C, string>;

/**
 * Rows keyed by the requested columns, one at a time; a column missing from the header reads
 * as "". Lazy, so callers keep only the rows they want.
 */
export function* readCsv<C extends string>(text: string, columns: readonly C[]): Generator<CsvRow<C>> {
  const records = csvRecords(text);
  const header = records.next();
  if (header.done) return;
  const index = columns.map((c) => header.value.indexOf(c));
  for (const record of records) {
    const row = {} as CsvRow<C>;
    columns.forEach((c, i) => {
      row[c] = index[i]! >= 0 ? (record[index[i]!] ?? "") : "";
    });
    yield row;
  }
}

/** Each row mapped through `fn`, keeping what it returns other than null. */
export function mapCsv<C extends string, T>(
  text: string,
  columns: readonly C[],
  fn: (row: CsvRow<C>) => T | null,
): T[] {
  const out: T[] = [];
  for (const row of readCsv(text, columns)) {
    const value = fn(row);
    if (value !== null) out.push(value);
  }
  return out;
}

/** A numeric field, or null when blank or not a number ("NA" in older nflverse files). */
export function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "" || value === "NA") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
