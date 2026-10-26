/**
 * nflverse season stat rows → stat-registry totals. Each registry stat names the nflverse
 * columns that sum to it; stats nflverse does not publish (longest plays, drops, broken
 * tackles, return touchdowns) are simply absent from imported seasons.
 */
import { normalizePosition, type Position } from "../domain/positions";
import { resolveTeamAbbr } from "../domain/teams";
import { STAT_REGISTRY, type RawStatKey, type StatCategory, type StatLine } from "../stats/registry";
import { mapCsv, num } from "./csv";

const COLUMNS: Partial<Record<RawStatKey, readonly string[]>> = {
  passCmp: ["completions"],
  passAtt: ["attempts"],
  passYds: ["passing_yards"],
  passTd: ["passing_tds"],
  passInt: ["passing_interceptions"],
  passSacked: ["sacks_suffered"],
  passSackYds: ["sack_yards_lost"],
  rushAtt: ["carries"],
  rushYds: ["rushing_yards"],
  rushTd: ["rushing_tds"],
  fumbles: ["fumbles_total"],
  rec: ["receptions"],
  recTargets: ["targets"],
  recYds: ["receiving_yards"],
  recTd: ["receiving_tds"],
  recYac: ["receiving_yards_after_catch"],
  tackles: ["def_tackles_solo", "def_tackle_assists"],
  tacklesForLoss: ["def_tackles_for_loss"],
  sacks: ["def_sacks"],
  defInt: ["def_interceptions"],
  defIntYds: ["def_interception_yards"],
  passDeflections: ["def_pass_defended"],
  forcedFumbles: ["def_fumbles_forced"],
  fumbleRecoveries: ["fumble_recovery_opp"],
  safeties: ["def_safeties"],
  defTd: ["def_tds"],
  blockedKicks: ["def_punt_blocks", "def_pat_blocks", "def_fg_blocks"],
  fgm: ["fg_made"],
  fga: ["fg_att"],
  fgLong: ["fg_long"],
  fgBlocked: ["fg_blocked"],
  fgm0_29: ["fg_made_0_19", "fg_made_20_29"],
  fgm30_39: ["fg_made_30_39"],
  fgm40_49: ["fg_made_40_49"],
  fgm50plus: ["fg_made_50_59", "fg_made_60_"],
  xpm: ["pat_made"],
  xpa: ["pat_att"],
  xpBlocked: ["pat_blocked"],
  punts: ["pt_att"],
  puntYds: ["pt_yards"],
  puntLong: ["pt_long"],
  puntIn20: ["pt_inside_20"],
  puntTouchbacks: ["pt_touchback"],
  puntBlocked: ["pt_blocked"],
  kickReturns: ["kickoff_returns"],
  kickReturnYds: ["kickoff_return_yards"],
  puntReturns: ["punt_returns"],
  puntReturnYds: ["punt_return_yards"],
};

/** nflverse reports sack yardage as a negative number; the registry counts yards lost. */
const NEGATED = new Set<RawStatKey>(["passSackYds"]);

/**
 * A category is recorded only when the player did the thing it is about: a running back's one
 * sack taken does not make him a passer. Defense counts any defensive stat.
 */
const GATES: Partial<Record<StatCategory, readonly RawStatKey[]>> = {
  passing: ["passAtt"],
  rushing: ["rushAtt"],
  receiving: ["rec", "recTargets"],
  kicking: ["fga", "xpa"],
  punting: ["punts"],
  returns: ["kickReturns", "puntReturns"],
};

const STAT_COLUMNS = [...new Set(Object.values(COLUMNS).flat())];

/** Registry totals from one nflverse row; categories the player never touched are left out. */
export function statLineFromNflverse(row: Readonly<Record<string, string>>): StatLine {
  const all: StatLine = {};
  for (const [key, columns] of Object.entries(COLUMNS) as [RawStatKey, readonly string[]][]) {
    const values = columns.map((c) => num(row[c]));
    if (values.every((v) => v === null)) continue;
    const total = values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    all[key] = NEGATED.has(key) ? Math.abs(total) : total;
  }
  const line: StatLine = {};
  for (const [key, value] of Object.entries(all) as [RawStatKey, number][]) {
    const category = STAT_REGISTRY[key].category;
    const gate =
      GATES[category] ??
      (Object.keys(all) as RawStatKey[]).filter((k) => STAT_REGISTRY[k].category === category);
    if (gate.some((k) => (all[k] ?? 0) !== 0)) line[key] = value;
  }
  return line;
}

export type ImportedStatRow = {
  nflverseId: string;
  teamAbbr: string;
  position: Position | null;
  gamesPlayed: number;
  totals: StatLine;
};

const ROW_COLUMNS = ["player_id", "recent_team", "position", "games", ...STAT_COLUMNS] as const;

/** One row per player in an nflverse season stats file (regular season or postseason). */
export function parseSeasonStats(text: string): ImportedStatRow[] {
  return mapCsv(text, ROW_COLUMNS, (row) => {
    const teamAbbr = resolveTeamAbbr(row.recent_team);
    if (!row.player_id || !teamAbbr) return null;
    const totals = statLineFromNflverse(row);
    if (Object.keys(totals).length === 0) return null;
    return {
      nflverseId: row.player_id,
      teamAbbr,
      position: row.position ? normalizePosition(row.position) : null,
      gamesPlayed: num(row.games) ?? 0,
      totals,
    };
  });
}
