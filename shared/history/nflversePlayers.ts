/** nflverse players, rosters and draft picks → the shapes the import mutations write. Pure. */
import type { RosterStatus } from "../domain/roster";
import { normalizePosition, type Position } from "../domain/positions";
import { resolveTeamAbbr } from "../domain/teams";
import { mapCsv, num, readCsv } from "./csv";

export type ImportedPlayer = {
  nflverseId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  position: Position;
  birthYear?: number;
  college?: string;
  heightIn?: number;
  weightLb?: number;
  espnId?: number;
  draft?: { year: number; round: number; pick?: number; teamAbbr?: string };
  undrafted?: boolean;
  /** Last season the player appeared in; drives `retired`. */
  lastSeason?: number;
};

const optional = (value: string) => num(value) ?? undefined;
const clean = (value: string) => (value.trim() === "" || value === "NA" ? undefined : value.trim());
const birthYear = (date: string) => optional(date.slice(0, 4));

const PLAYER_COLUMNS = [
  "gsis_id",
  "display_name",
  "first_name",
  "last_name",
  "birth_date",
  "position",
  "height",
  "weight",
  "college_name",
  "espn_id",
  "rookie_season",
  "last_season",
  "draft_year",
  "draft_round",
  "draft_pick",
  "draft_team",
] as const;

/** Players from `players.csv` for whom `keep` is true. Rows without an id or a known position are skipped. */
export function parsePlayers(csv: string, keep: (p: ImportedPlayer) => boolean): ImportedPlayer[] {
  return mapCsv(csv, PLAYER_COLUMNS, (row) => {
    const position = normalizePosition(row.position);
    if (!row.gsis_id || !position || !row.display_name) return null;
    const draftYear = optional(row.draft_year);
    const draftRound = optional(row.draft_round);
    const player: ImportedPlayer = {
      nflverseId: row.gsis_id,
      firstName: clean(row.first_name) ?? row.display_name.split(" ")[0]!,
      lastName: clean(row.last_name) ?? row.display_name.split(" ").slice(1).join(" "),
      displayName: row.display_name.trim(),
      position,
      birthYear: birthYear(row.birth_date),
      college: clean(row.college_name),
      heightIn: optional(row.height),
      weightLb: optional(row.weight),
      espnId: optional(row.espn_id),
      draft:
        draftYear !== undefined && draftRound !== undefined
          ? {
              year: draftYear,
              round: draftRound,
              pick: optional(row.draft_pick),
              teamAbbr: resolveTeamAbbr(row.draft_team) ?? undefined,
            }
          : undefined,
      undrafted: draftYear === undefined && optional(row.rookie_season) !== undefined ? true : undefined,
      lastSeason: optional(row.last_season),
    };
    return keep(player) ? player : null;
  });
}

export type ImportedRosterRow = {
  player: ImportedPlayer;
  teamAbbr: string;
  position: Position;
  jersey?: number;
  exp?: number;
  status: RosterStatus;
  /** Drafted by this team this year: a rookie on the club that picked him. */
  drafted: boolean;
};

/** nflverse roster statuses that mean the player is on the team; cuts, trades and retirements are not. */
const ROSTER_STATUS: Record<string, RosterStatus> = {
  ACT: "active",
  INA: "active",
  RES: "ir",
  DEV: "practice_squad",
};

const ROSTER_COLUMNS = [
  "season",
  "team",
  "position",
  "depth_chart_position",
  "jersey_number",
  "status",
  "full_name",
  "first_name",
  "last_name",
  "birth_date",
  "height",
  "weight",
  "college",
  "gsis_id",
  "espn_id",
  "years_exp",
  "entry_year",
  "draft_club",
] as const;

/** Players on a team in a season's roster file, one row per player (the latest listing wins). */
export function parseRoster(csv: string): ImportedRosterRow[] {
  const byPlayer = new Map<string, ImportedRosterRow>();
  for (const row of readCsv(csv, ROSTER_COLUMNS)) {
    const teamAbbr = resolveTeamAbbr(row.team);
    const status = ROSTER_STATUS[row.status];
    const position = normalizePosition(row.depth_chart_position) ?? normalizePosition(row.position);
    if (!row.gsis_id || !teamAbbr || !status || !position) continue;
    const name = row.full_name.trim();
    byPlayer.set(row.gsis_id, {
      teamAbbr,
      position,
      status,
      jersey: optional(row.jersey_number),
      exp: optional(row.years_exp),
      drafted: row.entry_year === row.season && resolveTeamAbbr(row.draft_club) === teamAbbr,
      player: {
        nflverseId: row.gsis_id,
        firstName: clean(row.first_name) ?? name.split(" ")[0]!,
        lastName: clean(row.last_name) ?? name.split(" ").slice(1).join(" "),
        displayName: name,
        position,
        birthYear: birthYear(row.birth_date),
        college: clean(row.college),
        heightIn: optional(row.height),
        weightLb: optional(row.weight),
        espnId: optional(row.espn_id),
      },
    });
  }
  return [...byPlayer.values()];
}

export type ImportedDraftPick = {
  year: number;
  round: number;
  overall: number;
  teamAbbr: string;
  nflverseId?: string;
  name: string;
  position?: Position;
  college?: string;
};

const DRAFT_COLUMNS = [
  "season",
  "round",
  "pick",
  "team",
  "gsis_id",
  "pfr_player_name",
  "position",
  "college",
] as const;

/** Draft picks made in the given years. */
export function parseDraftPicks(csv: string, years: ReadonlySet<number>): ImportedDraftPick[] {
  return mapCsv(csv, DRAFT_COLUMNS, (row) => {
    const year = num(row.season);
    const round = num(row.round);
    const overall = num(row.pick);
    const teamAbbr = resolveTeamAbbr(row.team);
    if (year === null || !years.has(year) || round === null || overall === null || !teamAbbr) return null;
    return {
      year,
      round,
      overall,
      teamAbbr,
      nflverseId: clean(row.gsis_id),
      name: row.pfr_player_name.trim(),
      position: normalizePosition(row.position) ?? undefined,
      college: clean(row.college),
    };
  });
}
