/** CSV exports (FEATURES.md 5.12): RFC 4180 text a spreadsheet opens as is. Pure. */
import { weekLabel, type WeekKey } from "../domain/calendar";
import { isRawStatKey, STAT_KEYS, type StatLine } from "../stats/registry";

/** Totals hold raw stats only; derived ones (rates, averages) are left to the spreadsheet. */
const RAW_KEYS = STAT_KEYS.filter(isRawStatKey);

type Cell = string | number | boolean | null | undefined;

function field(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A header row and data rows as CSV text, CRLF line endings as the RFC asks. */
export function toCsv(headers: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return [headers, ...rows].map((row) => row.map(field).join(",")).join("\r\n") + "\r\n";
}

export type GameExportRow = {
  year: number;
  weekKey: WeekKey;
  userIsHome: boolean | null;
  opponentName: string;
  us: number | null;
  them: number | null;
  result: string | null;
};

export function gamesCsv(games: readonly GameExportRow[]): string {
  const sorted = [...games].sort((a, b) => a.year - b.year);
  return toCsv(
    ["season", "week", "home_away", "opponent", "points_for", "points_against", "result"],
    sorted.map((g) => [
      g.year,
      weekLabel(g.weekKey, "long"),
      g.userIsHome === null ? "" : g.userIsHome ? "home" : "away",
      g.opponentName,
      g.us,
      g.them,
      g.result,
    ]),
  );
}

export type PlayerSeasonExportRow = {
  year: number;
  split: string;
  player: string;
  position: string | null;
  gamesPlayed: number;
  totals: StatLine;
};

/** One row per player season; a column per raw registry stat anyone recorded, in registry order. */
export function playerSeasonsCsv(rows: readonly PlayerSeasonExportRow[]): string {
  const used = RAW_KEYS.filter((key) => rows.some((r) => r.totals[key] !== undefined));
  return toCsv(
    ["season", "split", "player", "position", "games", ...used],
    rows.map((r) => [
      r.year,
      r.split,
      r.player,
      r.position,
      r.gamesPlayed,
      ...used.map((key) => r.totals[key]),
    ]),
  );
}
