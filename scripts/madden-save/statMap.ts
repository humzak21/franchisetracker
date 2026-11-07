/**
 * The save's stat columns in the app's vocabulary. Madden names a column the same way in its
 * per-game tables (GameOffensiveStats, GameDefensiveStats, GameKickingStats, the KP-return
 * twins) and its season tables, so one map serves box scores and season totals. Registry keys
 * with no column here (sack yards, targets) are simply not in the save.
 */
import { RAW_STATS, type RawStatKey, type StatLine } from "../../shared/stats/registry";
import type { TeamStatKey, TeamStatLine } from "../../shared/stats/teamRegistry";
import { num, type Row } from "./saveFile";

/** A column, or a column counted at a fraction (a half sack is half a sack). */
type Source = string | { field: string; times: number };

export const PLAYER_STAT_SOURCES: Partial<Record<RawStatKey, readonly Source[]>> = {
  passCmp: ["PASSCOMPLETED"],
  passAtt: ["PASSATTEMPTS"],
  passYds: ["PASSYARDS"],
  passTd: ["PASSTDS"],
  passInt: ["PASSINTS"],
  passSacked: ["PASSSACKED"],
  passLong: ["PASSLONGEST"],
  rushAtt: ["RUSHATTEMPTS"],
  rushYds: ["RUSHYARDS"],
  rushTd: ["RUSHTDS"],
  rushLong: ["RUSHLONGEST"],
  rushBrokenTackles: ["RUSHBROKENTACKLES"],
  fumbles: ["RUSHFUMBLES"],
  rec: ["RECEIVECATCHES"],
  recYds: ["RECEIVEYARDS"],
  recTd: ["RECEIVETDS"],
  recLong: ["RECEIVELONGEST"],
  recYac: ["RECEIVEYARDSAFTER"],
  recDrops: ["RECEIVEDROPS"],
  tackles: ["DEFTACKLES"],
  tacklesForLoss: ["DEFTACKLESFORLOSS"],
  sacks: ["DLINESACKS", { field: "DLINEHALFSACK", times: 0.5 }],
  defInt: ["DSECINTS"],
  defIntYds: ["DSECINTRETURNYARDS"],
  passDeflections: ["DEFPASSDEFLECTIONS"],
  forcedFumbles: ["DLINEFORCEDFUMBLES"],
  fumbleRecoveries: ["DLINEFUMBLERECOVERIES"],
  safeties: ["DLINESAFETIES"],
  defTd: ["DSECINTTDS", "DLINEFUMBLETDS"],
  blockedKicks: ["DLINEBLOCKS"],
  fgm: ["KICKFGMADE"],
  fga: ["KICKFGATTEMPTS"],
  fgLong: ["KICKFGLONGEST"],
  fgBlocked: ["KICKFGBLOCKED"],
  fgm50plus: ["KICKFGMADE50ORMORE"],
  xpm: ["KICKEPMADE"],
  xpa: ["KICKEPATTEMPTS"],
  xpBlocked: ["KICKEPBLOCKED"],
  punts: ["PUNTATTEMPTS"],
  puntYds: ["PUNTYARDS"],
  puntLong: ["PUNTLONGEST"],
  puntIn20: ["PUNTIN20"],
  puntTouchbacks: ["PUNTTOUCHBACKS"],
  puntBlocked: ["PUNTBLOCKED"],
  kickReturns: ["KRETATTEMPTS"],
  kickReturnYds: ["KRETYARDS"],
  kickReturnTd: ["KRETTDS"],
  kickReturnLong: ["KRETLONGEST"],
  puntReturns: ["PRETATTEMPTS"],
  puntReturnYds: ["PRETYARDS"],
  puntReturnTd: ["PRETTDS"],
  puntReturnLong: ["PRETLONGEST"],
};

const fieldOf = (source: Source) => (typeof source === "string" ? source : source.field);
const timesOf = (source: Source) => (typeof source === "string" ? 1 : source.times);

/**
 * A player's stat line from one or more of his rows (a defensive row and a return row merged).
 * A category is kept only when the row has its columns and something in it is not zero, so a
 * receiver's line never carries empty passing numbers; a quarterback's zero interceptions stay.
 */
export function mapPlayerStats(row: Row): StatLine {
  const values = new Map<RawStatKey, number>();
  for (const [key, sources] of Object.entries(PLAYER_STAT_SOURCES) as [RawStatKey, readonly Source[]][]) {
    if (!sources.every((s) => fieldOf(s) in row)) continue;
    values.set(
      key,
      sources.reduce((sum, s) => sum + num(row, fieldOf(s)) * timesOf(s), 0),
    );
  }
  const liveCategories = new Set(
    [...values].filter(([, value]) => value !== 0).map(([key]) => RAW_STATS[key].category),
  );
  const line: StatLine = {};
  for (const [key, value] of values) if (liveCategories.has(RAW_STATS[key].category)) line[key] = value;
  return line;
}

/** Madden's TeamStats columns behind each team stat; totals are passing plus rushing, as the app counts them. */
export const TEAM_STAT_SOURCES: Partial<Record<TeamStatKey, readonly string[]>> = {
  firstDowns: ["FIRSTDOWNS"],
  plays: ["PASSATTEMPTS", "RUSHATTEMPTS", "SACKSALLOWED"],
  totalYds: ["OFFPASSYARDS", "OFFRUSHYARDS"],
  passYds: ["OFFPASSYARDS"],
  passAtt: ["PASSATTEMPTS"],
  rushYds: ["OFFRUSHYARDS"],
  rushAtt: ["RUSHATTEMPTS"],
  thirdDownConv: ["THIRDDOWNCONV"],
  thirdDownAtt: ["THIRDDOWNS"],
  fourthDownConv: ["FOURTHDOWNCONV"],
  fourthDownAtt: ["FOURTHDOWNS"],
  twoPtConv: ["TWOPOINTCONVMADE"],
  twoPtAtt: ["TWOPOINTCONVATTEMPTS"],
  redZoneTd: ["OFFREDZONETDS"],
  redZoneFg: ["OFFREDZONEFGS"],
  redZoneAtt: ["OFFREDZONES"],
  turnovers: ["GIVEAWAYS"],
  fumblesLost: ["FUMBLESLOST"],
  intThrown: ["PASSINTS"],
  sacksAllowed: ["SACKSALLOWED"],
  penalties: ["PENALTIES"],
  penaltyYds: ["PENALTYYARDS"],
  possessionSec: ["POSSESSIONTIME"],
};

/** A team's game or season line. Completions are not a team column; they come from the player lines. */
export function mapTeamStats(row: Row, passCmp: number | null): TeamStatLine {
  const line: TeamStatLine = {};
  for (const [key, fields] of Object.entries(TEAM_STAT_SOURCES) as [TeamStatKey, readonly string[]][]) {
    if (!fields.every((f) => f in row)) continue;
    line[key] = fields.reduce((sum, f) => sum + num(row, f), 0);
  }
  if (passCmp !== null) line.passCmp = passCmp;
  return line;
}
