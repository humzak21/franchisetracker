/** Gallery fixtures, taken from the 2025 season of the workbook so components are judged on real shapes. */
import { NFL_TEAMS, type TeamSeed } from "@shared/domain";
import type { StatLine } from "@shared/stats";
import type { PlayerLike } from "@/components/player/PlayerChip";

export const TEAMS: Record<string, TeamSeed> = Object.fromEntries(NFL_TEAMS.map((t) => [t.abbr, t]));
export const NE = TEAMS.NE!;
export const BUF = TEAMS.BUF!;
export const KC = TEAMS.KC!;

const pat = (displayName: string, position: string, jersey: number): PlayerLike => ({
  displayName,
  position,
  jersey,
  team: NE,
});

export const PLAYERS = {
  maye: pat("Drake Maye", "QB", 10),
  henderson: pat("TreVeyon Henderson", "HB", 32),
  diggs: pat("Stefon Diggs", "WR", 8),
  douglas: pat("DeMario Douglas", "WR", 3),
  henry: pat("Hunter Henry", "TE", 85),
  williams: pat("Kyle Williams", "WR", 18),
  boutte: pat("Kayshon Boutte", "WR", 9),
  spillane: pat("Robert Spillane", "MLB", 14),
  gonzalez: pat("Christian Gonzalez", "CB", 0),
  borregales: pat("Andres Borregales", "K", 36),
};

export type ReceiverRow = {
  id: string;
  player: PlayerLike;
  games: number;
  stats: StatLine;
  games100: number;
  games5rec: number;
};

const receiver = (
  id: keyof typeof PLAYERS,
  games: number,
  stats: StatLine,
  games100: number,
  games5rec: number,
): ReceiverRow => ({
  id,
  player: PLAYERS[id],
  games,
  stats,
  games100,
  games5rec,
});

export const RECEIVERS_2025: ReceiverRow[] = [
  receiver("diggs", 17, { rec: 120, recYds: 1687, recTd: 21, recLong: 64, recTargets: 158 }, 9, 15),
  receiver("douglas", 15, { rec: 87, recYds: 935, recTd: 10, recLong: 55, recTargets: 121 }, 2, 8),
  receiver("henry", 17, { rec: 51, recYds: 608, recTd: 1, recLong: 45, recTargets: 74 }, 1, 2),
  receiver("williams", 17, { rec: 43, recYds: 521, recTd: 5, recLong: 68, recTargets: 66 }, 0, 2),
  receiver("boutte", 17, { rec: 36, recYds: 373, recTd: 6, recLong: 26, recTargets: 55 }, 0, 3),
  receiver("henderson", 17, { rec: 32, recYds: 209, recTd: 2, recLong: 35, recTargets: 41 }, 0, 1),
];

/** Maye's 2025 passing yards by week (W1 to W18, null on the bye). */
export const MAYE_WEEKLY_YDS = [
  262,
  301,
  228,
  344,
  219,
  null,
  381,
  255,
  198,
  290,
  240,
  187,
  231,
  266,
  205,
  238,
  214,
  169,
];
export const DIGGS_WEEKLY_REC = [7, 9, 5, 8, 6, null, 10, 11, 4, 8, 7, 9, 6, 5, 8, 7, 6, 4];

export const MAYE_2025: StatLine = {
  passCmp: 363,
  passAtt: 525,
  passYds: 4228,
  passTd: 42,
  passInt: 18,
  passSacked: 19,
  rushAtt: 28,
  rushYds: 267,
  rushTd: 5,
};

/** League Stats tab, 2025: "27.3 - T-3rd" and friends, structured. */
export const TEAM_STATS_2025 = [
  { label: "Points per game", value: "27.3", rank: 3, tied: true },
  { label: "Total offense", value: "5,570", rank: 7 },
  { label: "Passing yards", value: "4,153", rank: 4 },
  { label: "Rushing yards", value: "1,417", rank: 28 },
  { label: "First downs", value: "336", rank: 1 },
  { label: "3rd down", value: "52%", rank: 3, tied: true },
  { label: "Points allowed per game", value: "26.5", rank: 32 },
  { label: "Total defense", value: "5,485", rank: 22 },
];
