/**
 * Model JSON → normalized draft. The model's answer is untrusted: every field is checked and
 * anything malformed becomes null plus a warning instead of an exception. Rows from the
 * per-category arrays are merged into one line per player per team.
 */
import { normalizePosition, type Position } from "../domain/positions";
import { resolveTeamAbbr } from "../domain/teams";
import { STAT_CATEGORIES, extractionField, type RawStatKey, type StatLine } from "../stats/registry";
import { TEAM_STAT_KEYS, parseClock, type TeamStatLine } from "../stats/teamRegistry";
import { nameTokens } from "./nameMatch";
import { rawKeysInCategory, teamExtractionField } from "./schema";
import type {
  BoxScoreDraft,
  DraftLine,
  DraftWarning,
  FieldConfidence,
  GameHeader,
  TeamStatsDraft,
} from "./types";

export type Normalized<D> = { draft: D; confidence: FieldConfidence[]; warnings: DraftWarning[] };

export type Obj = Record<string, unknown>;
export const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;
const numList = (value: unknown): number[] =>
  Array.isArray(value) ? value.map(num).filter((n): n is number => n !== null) : [];
export const rows = (value: unknown): Obj[] => (Array.isArray(value) ? value.filter(isObj) : []);
export const clamp01 = (value: number | null) => (value === null ? 0.5 : Math.min(1, Math.max(0, value)));
/** Fields the model flagged as unclear are reviewed before anything it was sure of. */
export const UNCLEAR_CONFIDENCE = 0.35;
/** Fields below this confidence are listed for a look before commit; rows below it start unaccepted. */
export const CHECK_BELOW = 0.8;
/**
 * In a list, a doubtful row already starts unaccepted, so only the fields the model called
 * unclear are singled out within it.
 */
export const ROW_CHECK_BELOW = 0.5;

function header(raw: Obj, warnings: DraftWarning[]): GameHeader {
  const team = (field: "home_team" | "away_team", path: string) => {
    const printed = str(raw[field]);
    const abbr = resolveTeamAbbr(printed);
    if (printed && !abbr) warnings.push({ path, message: `Unknown team "${printed}"`, severity: "error" });
    return abbr;
  };
  const home = numList(raw.home_quarters);
  const away = numList(raw.away_quarters);
  return {
    homeAbbr: team("home_team", "game.homeAbbr"),
    awayAbbr: team("away_team", "game.awayAbbr"),
    homeScore: num(raw.home_score),
    awayScore: num(raw.away_score),
    overtime: raw.overtime === true || home.length > 4 || away.length > 4,
    lineScore: home.length > 0 && away.length > 0 ? { home, away } : null,
  };
}

export function rowConfidence(
  row: Obj,
  prefix: string,
  fields: Record<string, string>,
  out: FieldConfidence[],
) {
  const base = clamp01(num(row.confidence));
  const unclear = new Set(
    Array.isArray(row.unclear_fields) ? row.unclear_fields.filter((f) => typeof f === "string") : [],
  );
  for (const [field, path] of Object.entries(fields)) {
    out.push({
      path: `${prefix}.${path}`,
      value: unclear.has(field) ? Math.min(base, UNCLEAR_CONFIDENCE) : base,
    });
  }
}

/** A stable, readable line id: team plus the name's tokens, suffixed when two players collide. */
function lineId(teamAbbr: string | null, name: string, taken: Set<string>): string {
  const base = `${(teamAbbr ?? "unk").toLowerCase()}-${nameTokens(name).join("-") || "player"}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

export function normalizeBoxScore(raw: unknown): Normalized<BoxScoreDraft> {
  const warnings: DraftWarning[] = [];
  const confidence: FieldConfidence[] = [];
  const obj = isObj(raw) ? raw : {};
  const game = header(obj, warnings);
  const byKey = new Map<string, DraftLine>();
  const ids = new Set<string>();

  for (const category of STAT_CATEGORIES) {
    for (const row of rows(obj[category])) {
      const name = str(row.name);
      if (!name) continue;
      const teamAbbr = resolveTeamAbbr(str(row.team));
      const key = `${teamAbbr ?? "?"}|${nameTokens(name).join(" ")}`;
      let line = byKey.get(key);
      if (!line) {
        line = {
          id: lineId(teamAbbr, name, ids),
          teamAbbr,
          name,
          position: null,
          stats: {},
          playerId: null,
          match: { status: "new", candidates: [] },
        };
        byKey.set(key, line);
      }
      const printedPosition = str(row.position);
      if (printedPosition && !line.position) line.position = normalizePosition(printedPosition);
      const fields: Record<string, string> = { name: "name" };
      for (const stat of rawKeysInCategory(category)) {
        const value = num(row[extractionField(stat)]);
        if (value === null) continue;
        const existing = line.stats[stat];
        if (existing !== undefined && existing !== value) {
          warnings.push({
            path: `lines.${line.id}.stats.${stat}`,
            message: `${name}: two screenshots disagree (${existing} and ${value})`,
            severity: "warning",
          });
        }
        line.stats[stat as RawStatKey] = value;
        fields[extractionField(stat)] = `stats.${stat}`;
      }
      rowConfidence(row, `lines.${line.id}`, fields, confidence);
    }
  }
  return { draft: { target: "game_box_score", game, lines: [...byKey.values()] }, confidence, warnings };
}

export function normalizeTeamStats(raw: unknown): Normalized<TeamStatsDraft> {
  const warnings: DraftWarning[] = [];
  const confidence: FieldConfidence[] = [];
  const obj = isObj(raw) ? raw : {};
  const game = header(obj, warnings);
  const teams = rows(obj.teams).map((row, i) => {
    const printed = str(row.team);
    const teamAbbr = resolveTeamAbbr(printed);
    if (printed && !teamAbbr) {
      warnings.push({ path: `teams.${i}.teamAbbr`, message: `Unknown team "${printed}"`, severity: "error" });
    }
    const stats: TeamStatLine = {};
    const fields: Record<string, string> = {};
    for (const key of TEAM_STAT_KEYS) {
      const field = teamExtractionField(key);
      const value =
        key === "possessionSec" ? (str(row[field]) ? parseClock(String(row[field])) : null) : num(row[field]);
      if (value === null) continue;
      stats[key] = value;
      fields[field] = `stats.${key}`;
    }
    rowConfidence(row, `teams.${i}`, fields, confidence);
    return { teamAbbr, stats };
  });
  return { draft: { target: "team_game_stats", game, teams }, confidence, warnings };
}

/** A best guess at a position from a stat line, for new players whose screen printed none. */
export function inferPosition(stats: StatLine): Position {
  const has = (key: RawStatKey) => (stats[key] ?? 0) > 0;
  if (has("passAtt")) return "QB";
  if (has("fga") || has("xpa")) return "K";
  if (has("punts")) return "P";
  if (has("rushAtt") && (stats.rushAtt ?? 0) >= (stats.rec ?? 0)) return "HB";
  if (has("rec") || has("kickReturns") || has("puntReturns")) return "WR";
  if (has("sacks") || has("tacklesForLoss")) return "LEDG";
  if (has("defInt") || has("passDeflections")) return "CB";
  return "MLB";
}
