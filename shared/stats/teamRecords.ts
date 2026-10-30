/**
 * Team records (`docs/STATS-HUB.md` 4.7): the team's best and worst games and seasons, declared
 * once. Each list keeps its top entries as a board, rewritten a season at a time.
 */
import type { WeekKey } from "../domain/calendar";
import type { LineScore } from "../games/lineScore";
import type { PlayMoment } from "../games/scoringPlay";
import { gameTurn } from "./quarters";
import { BOARD_SIZE } from "./recordBoards";
import type { TeamStatLine } from "./teamRegistry";

export const TEAM_RECORD_SCOPES = ["game", "season"] as const;
export type TeamRecordScope = (typeof TEAM_RECORD_SCOPES)[number];

export type TeamGameFacts<G extends string = string, S extends string = string, T extends string = string> = {
  gameId: G;
  seasonId: S;
  year: number;
  weekKey: WeekKey;
  opponentTeamId: T | null;
  userIsHome: boolean;
  us: number;
  them: number;
  won: boolean;
  own: TeamStatLine | null;
  opponent: TeamStatLine | null;
  lineScore: LineScore | null;
  plays: readonly PlayMoment[];
};

type Reading = number | null;

type Stat = {
  label: string;
  /** Fewest yards allowed is a record too; lower wins those lists. */
  better: "higher" | "lower";
  game: ((g: TeamGameFacts) => Reading) | null;
  season: ((games: readonly TeamGameFacts[]) => Reading) | null;
};

const each = (games: readonly TeamGameFacts[], read: (g: TeamGameFacts) => Reading): number | null => {
  const values = games.flatMap((g) => read(g) ?? []);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
};

const total = (read: (g: TeamGameFacts) => Reading) => (games: readonly TeamGameFacts[]) => each(games, read);

const yards = (g: TeamGameFacts) => g.own?.totalYds ?? null;
const allowed = (g: TeamGameFacts) => g.opponent?.totalYds ?? null;
const takeaways = (g: TeamGameFacts) => g.opponent?.turnovers ?? null;
const sacks = (g: TeamGameFacts) => g.opponent?.sacksAllowed ?? null;

const stat = (s: Partial<Stat> & Pick<Stat, "label">): Stat => ({
  better: "higher",
  game: null,
  season: null,
  ...s,
});

export const TEAM_RECORD_STATS = {
  pointsFor: stat({ label: "Most points", game: (g) => g.us, season: total((g) => g.us) }),
  pointsAgainst: stat({
    label: "Fewest points allowed",
    better: "lower",
    game: (g) => g.them,
    season: total((g) => g.them),
  }),
  biggestWin: stat({ label: "Biggest win", game: (g) => (g.won ? g.us - g.them : null) }),
  worstLoss: stat({ label: "Worst loss", game: (g) => (g.us < g.them ? g.them - g.us : null) }),
  pointDifferential: stat({ label: "Best point differential", season: total((g) => g.us - g.them) }),
  wins: stat({ label: "Most wins", season: total((g) => (g.won ? 1 : 0)) }),
  totalYds: stat({ label: "Most yards", game: yards, season: total(yards) }),
  passYds: stat({
    label: "Most passing yards",
    game: (g) => g.own?.passYds ?? null,
    season: total((g) => g.own?.passYds ?? null),
  }),
  rushYds: stat({
    label: "Most rushing yards",
    game: (g) => g.own?.rushYds ?? null,
    season: total((g) => g.own?.rushYds ?? null),
  }),
  firstDowns: stat({
    label: "Most first downs",
    game: (g) => g.own?.firstDowns ?? null,
    season: total((g) => g.own?.firstDowns ?? null),
  }),
  yardsAllowed: stat({
    label: "Fewest yards allowed",
    better: "lower",
    game: allowed,
    season: total(allowed),
  }),
  sacks: stat({ label: "Most sacks", game: sacks, season: total(sacks) }),
  takeaways: stat({ label: "Most takeaways", game: takeaways, season: total(takeaways) }),
  pointsInQuarter: stat({
    label: "Most points in a quarter",
    game: (g) => {
      const best = Math.max(0, ...quarterPoints(g));
      return best > 0 ? best : null;
    },
  }),
  comeback: stat({
    label: "Largest comeback",
    game: (g) => {
      const { comeback } = gameTurn(g);
      return comeback > 0 ? comeback : null;
    },
  }),
  blownLead: stat({
    label: "Largest lead lost",
    game: (g) => {
      const { blownLead } = gameTurn(g);
      return blownLead > 0 ? blownLead : null;
    },
  }),
} as const satisfies Record<string, Stat>;

export type TeamRecordStat = keyof typeof TEAM_RECORD_STATS;
export const TEAM_RECORD_STAT_KEYS = Object.keys(TEAM_RECORD_STATS) as TeamRecordStat[];

function quarterPoints(game: TeamGameFacts): number[] {
  const line = game.lineScore;
  if (!line) return [];
  return game.userIsHome ? line.home : line.away;
}

export type TeamEntry<G extends string = string, S extends string = string, T extends string = string> = {
  value: number;
  seasonId: S;
  year: number;
  gameId?: G;
  weekKey?: WeekKey;
  opponentTeamId?: T;
  /** The quarter of a quarter record. */
  period?: number;
};

export type TeamRecordList<E> = { statKey: TeamRecordStat; scope: TeamRecordScope; entries: E[] };

/** Every list's entries for one season's games. */
export function teamSeasonEntries<G extends string, S extends string, T extends string>(
  games: readonly TeamGameFacts<G, S, T>[],
): TeamRecordList<TeamEntry<G, S, T>>[] {
  const first = games[0];
  if (!first) return [];
  return TEAM_RECORD_STAT_KEYS.flatMap((statKey) => {
    const def: Stat = TEAM_RECORD_STATS[statKey];
    const out: TeamRecordList<TeamEntry<G, S, T>>[] = [];
    if (def.game) {
      const read = def.game;
      const entries = games.flatMap((g) => {
        const value = read(g);
        if (value === null) return [];
        const quarter = statKey === "pointsInQuarter" ? quarterPoints(g) : [];
        return [
          {
            value,
            seasonId: g.seasonId,
            year: g.year,
            gameId: g.gameId,
            weekKey: g.weekKey,
            ...(g.opponentTeamId ? { opponentTeamId: g.opponentTeamId } : {}),
            ...(quarter.length > 0 ? { period: quarter.indexOf(value) + 1 } : {}),
          },
        ];
      });
      out.push({ statKey, scope: "game", entries });
    }
    if (def.season) {
      const value = def.season(games);
      const entries = value === null ? [] : [{ value, seasonId: first.seasonId, year: first.year }];
      out.push({ statKey, scope: "season", entries });
    }
    return out;
  });
}

/** A board with one season's entries replaced, so a correction lowers them too. Best first. */
export function mergeTeamEntries<E extends TeamEntry>(
  statKey: TeamRecordStat,
  current: readonly E[],
  seasonId: string,
  incoming: readonly E[],
  size: number = BOARD_SIZE,
): E[] {
  const sign = TEAM_RECORD_STATS[statKey].better === "higher" ? -1 : 1;
  return [...current.filter((e) => e.seasonId !== seasonId), ...incoming]
    .sort((a, b) => sign * (a.value - b.value) || a.year - b.year)
    .slice(0, size);
}
