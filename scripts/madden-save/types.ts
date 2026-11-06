/** What the exporter writes: the save's content in the app's vocabulary (keys, week keys, abbreviations). */
import type { AwardType } from "../../shared/domain/awards";
import type { PlayoffResult, WeekKey } from "../../shared/domain/calendar";
import type { Position } from "../../shared/domain/positions";
import type { DevTrait, RosterStatus } from "../../shared/domain/roster";
import type { PatResult, ScoringKind } from "../../shared/domain/scoring";
import type { Conference } from "../../shared/domain/teams";
import type { StatLine } from "../../shared/stats/registry";
import type { TeamStatLine } from "../../shared/stats/teamRegistry";

export type ExportTeam = { abbr: string; city: string; name: string; maddenIndex: number };

export type GameLine = {
  teamAbbr: string;
  name: string;
  position: Position | null;
  started: boolean;
  stats: StatLine;
};

export type ScoringPlay = {
  order: number;
  period: number;
  /** Seconds left in the period. */
  clock: number;
  teamAbbr: string;
  kind: ScoringKind;
  pat: PatResult | null;
  homeScore: number;
  awayScore: number;
  description: string;
};

export type ExportGame = {
  year: number;
  week: WeekKey;
  awayAbbr: string;
  homeAbbr: string;
  played: boolean;
  awayScore: number | null;
  homeScore: number | null;
  overtime: boolean;
  /** The game was simulated rather than played by the user. */
  simmed: boolean;
  lineScore: { home: number[]; away: number[] } | null;
  weather: { condition: string; temperatureF: number; wind: string } | null;
  lines: GameLine[];
  teams: { teamAbbr: string; stats: TeamStatLine }[];
  plays: ScoringPlay[];
};

export type RosterRow = {
  year: number;
  teamAbbr: string;
  name: string;
  firstName: string;
  lastName: string;
  position: Position | null;
  jersey: number;
  ovr: number;
  age: number;
  exp: number;
  devTrait: DevTrait | null;
  status: RosterStatus;
  heightIn: number;
  weightLb: number;
  draft: { year: number; round: number; pickInRound: number; teamAbbr: string | null } | null;
};

export type FreeAgentRow = { name: string; position: Position | null; ovr: number; age: number; exp: number };

export type StandingRow = {
  year: number;
  teamAbbr: string;
  w: number;
  l: number;
  t: number;
  divisionRank: number | null;
  seed: number | null;
  pointsFor: number;
  pointsAgainst: number;
};

/** A finished season of a team: what Madden keeps per season once the games are gone. */
export type TeamSeasonRow = {
  year: number;
  teamAbbr: string;
  w: number;
  l: number;
  t: number;
  madePlayoffs: boolean;
  wonDivision: boolean;
  playoffResult: PlayoffResult | null;
};

export type SeasonStatRow = {
  year: number;
  teamAbbr: string | null;
  name: string;
  position: Position | null;
  gamesPlayed: number;
  gamesStarted: number;
  stats: StatLine;
};

export type AwardRow = {
  year: number;
  /** Weekly awards only. */
  week?: WeekKey;
  award: AwardType;
  conference?: Conference;
  name: string;
  teamAbbr: string | null;
  position: Position | null;
  /** The save keeps no season on a weekly award; this one's season was worked out from where it sits. */
  seasonGuessed?: boolean;
};

export type DraftRow = {
  year: number;
  round: number;
  pickInRound: number;
  overall: number;
  teamAbbr: string | null;
  name: string;
  position: Position | null;
  /** As of the save, not draft day. */
  ovr: number;
  age: number;
};

export type InjuryRow = {
  year: number;
  teamAbbr: string;
  name: string;
  position: Position | null;
  injury: string;
  weeksMin: number;
  weeksMax: number;
  ir: boolean;
};

export type ExportBundle = {
  source: { file: string; game: string; schema: { major: number; minor: number } | null; exportedAt: string };
  franchise: {
    userTeamAbbr: string | null;
    startYear: number;
    currentYear: number;
    /** The week about to be played. */
    currentWeek: WeekKey | null;
    stage: string;
  };
  teams: ExportTeam[];
  games: ExportGame[];
  rosters: RosterRow[];
  freeAgents: FreeAgentRow[];
  standings: StandingRow[];
  teamSeasons: TeamSeasonRow[];
  seasonStats: SeasonStatRow[];
  awards: AwardRow[];
  draft: DraftRow[];
  injuries: InjuryRow[];
};
