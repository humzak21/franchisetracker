/** The save's Player table: everyone in the league, with what the roster and draft screens show. */
import { normalizePosition, type Position } from "../../shared/domain/positions";
import type { DevTrait, RosterStatus } from "../../shared/domain/roster";
import { num, str, type Row, type SaveFile } from "./saveFile";
import type { Teams } from "./teams";
import type { DraftRow, FreeAgentRow, InjuryRow, RosterRow } from "./types";

const PLAYER_FIELDS = [
  "FirstName",
  "LastName",
  "Position",
  "TeamIndex",
  "JerseyNum",
  "OverallRating",
  "Age",
  "YearsPro",
  "TraitDevelopment",
  "ContractStatus",
  "InjuryStatus",
  "InjuryType",
  "IsInjuredReserve",
  "MinInjuryDuration",
  "MaxInjuryDuration",
  "PLYR_DRAFTROUND",
  "PLYR_DRAFTPICK",
  "PLYR_DRAFTTEAM",
  "Height",
  "Weight",
  "GameStats",
  "SeasonStats",
] as const;

/** Madden 27 names its dev traits after the college tiers; the app keeps the older names. */
const DEV_TRAITS: Record<string, DevTrait> = {
  Normal: "normal",
  College_Impact: "star",
  College_Star: "superstar",
  College_Elite: "xfactor",
};

/** Weights are stored as pounds over 160. */
const WEIGHT_BASE = 160;

export type MaddenPlayer = {
  index: number;
  firstName: string;
  lastName: string;
  name: string;
  position: Position | null;
  teamIndex: number;
  jersey: number;
  ovr: number;
  age: number;
  yearsPro: number;
  devTrait: DevTrait | null;
  contractStatus: string;
  /** On a team's roster in this status, or null for free agents, prospects and the retired. */
  status: RosterStatus | null;
  injured: boolean;
  injury: { type: string; weeksMin: number; weeksMax: number; ir: boolean } | null;
  draft: { round: number; pickInRound: number; teamOrigId: number } | null;
  heightIn: number;
  weightLb: number;
  gameStatsRef: unknown;
  seasonStatsRef: unknown;
};

function statusOf(row: Row): RosterStatus | null {
  switch (str(row, "ContractStatus")) {
    case "Signed":
      return row.IsInjuredReserve === true ? "ir" : "active";
    case "PracticeSquad":
      return "practice_squad";
    default:
      return null;
  }
}

function toPlayer(index: number, row: Row): MaddenPlayer {
  const round = num(row, "PLYR_DRAFTROUND");
  const firstName = str(row, "FirstName");
  const lastName = str(row, "LastName");
  const injured = str(row, "InjuryStatus") === "Injured";
  return {
    index,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    position: normalizePosition(str(row, "Position")),
    teamIndex: num(row, "TeamIndex"),
    jersey: num(row, "JerseyNum"),
    ovr: num(row, "OverallRating"),
    age: num(row, "Age"),
    yearsPro: num(row, "YearsPro"),
    devTrait: DEV_TRAITS[str(row, "TraitDevelopment")] ?? null,
    contractStatus: str(row, "ContractStatus"),
    status: statusOf(row),
    injured,
    injury: injured
      ? {
          type: str(row, "InjuryType"),
          weeksMin: num(row, "MinInjuryDuration"),
          weeksMax: num(row, "MaxInjuryDuration"),
          ir: row.IsInjuredReserve === true,
        }
      : null,
    // Round 63 marks the undrafted.
    draft:
      round >= 1 && round <= 7
        ? { round, pickInRound: num(row, "PLYR_DRAFTPICK"), teamOrigId: num(row, "PLYR_DRAFTTEAM") }
        : null,
    heightIn: num(row, "Height"),
    weightLb: num(row, "Weight") + WEIGHT_BASE,
    gameStatsRef: row.GameStats,
    seasonStatsRef: row.SeasonStats,
  };
}

export async function readPlayers(save: SaveFile): Promise<MaddenPlayer[]> {
  const rows = await save.rows("Player", PLAYER_FIELDS);
  return rows.map(({ index, row }) => toPlayer(index, row));
}

/** "HipDislocationCoupleGames" → "Hip dislocation". */
export function injuryLabel(type: string): string {
  const words = type
    .replace(/(CoupleGames|SeasonEnding|MultipleWeeks|Max_|Invalid_)$/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export function rosterRows(players: MaddenPlayer[], teams: Teams, year: number): RosterRow[] {
  return players.flatMap((p) => {
    const team = teams.ofIndex(p.teamIndex);
    if (!p.status || !team) return [];
    const draftTeam = p.draft ? teams.ofOrigId(p.draft.teamOrigId) : null;
    return [
      {
        year,
        teamAbbr: team.abbr,
        name: p.name,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        jersey: p.jersey,
        ovr: p.ovr,
        age: p.age,
        exp: p.yearsPro,
        devTrait: p.devTrait,
        status: p.status,
        heightIn: p.heightIn,
        weightLb: p.weightLb,
        draft: p.draft
          ? {
              year: year - p.yearsPro,
              round: p.draft.round,
              pickInRound: p.draft.pickInRound,
              teamAbbr: draftTeam?.abbr ?? null,
            }
          : null,
      },
    ];
  });
}

export function freeAgentRows(players: MaddenPlayer[]): FreeAgentRow[] {
  return players
    .filter((p) => p.contractStatus === "FreeAgent")
    .map((p) => ({ name: p.name, position: p.position, ovr: p.ovr, age: p.age, exp: p.yearsPro }))
    .sort((a, b) => b.ovr - a.ovr);
}

/** The franchise's drafts, rebuilt from each player's draft columns; earlier drafts are real history. */
export function draftRows(
  players: MaddenPlayer[],
  teams: Teams,
  year: number,
  startYear: number,
): DraftRow[] {
  // A slot claimed twice (a player whose years-pro count drifted) goes to the one still in the league.
  const standing = (p: MaddenPlayer) => (p.status ? 0 : p.contractStatus === "FreeAgent" ? 1 : 2);
  const bySlot = new Map<string, { p: MaddenPlayer; row: DraftRow }>();
  for (const p of [...players].sort((a, b) => standing(a) - standing(b))) {
    if (!p.draft || p.contractStatus === "Draft") continue;
    const draftYear = year - p.yearsPro;
    if (draftYear < startYear) continue;
    const { round, pickInRound, teamOrigId } = p.draft;
    const key = `${draftYear}|${round}|${pickInRound}`;
    if (bySlot.has(key)) continue;
    bySlot.set(key, {
      p,
      row: {
        year: draftYear,
        round,
        pickInRound,
        overall: (round - 1) * 32 + pickInRound,
        teamAbbr: teams.ofOrigId(teamOrigId)?.abbr ?? null,
        name: p.name,
        position: p.position,
        ovr: p.ovr,
        age: p.age,
      },
    });
  }
  return [...bySlot.values()].map(({ row }) => row).sort((a, b) => a.year - b.year || a.overall - b.overall);
}

export function injuryRows(players: MaddenPlayer[], teams: Teams, year: number): InjuryRow[] {
  return players.flatMap((p) => {
    const team = teams.ofIndex(p.teamIndex);
    if (!p.injury || !p.status || !team) return [];
    return [
      {
        year,
        teamAbbr: team.abbr,
        name: p.name,
        position: p.position,
        injury: injuryLabel(p.injury.type),
        weeksMin: p.injury.weeksMin,
        weeksMax: p.injury.weeksMax,
        ir: p.injury.ir,
      },
    ];
  });
}
