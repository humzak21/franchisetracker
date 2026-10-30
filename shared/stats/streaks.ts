/**
 * Streaks (FEATURES.md 5.5): team runs over the franchise's games and player runs over the
 * games a player appeared in, both oldest first. A streak counts only the games it applies to:
 * a home win streak skips road games rather than ending on them.
 */
import type { WeekKey } from "../domain/calendar";
import { statValue } from "./aggregate";
import type { StatLine } from "./registry";

/** Where a streak stands: a game's season and week, or a season alone for a season-long run. */
export type StreakPoint<S extends string = string> = { seasonId: S; year: number; weekKey?: WeekKey };

export type Run<S extends string = string> = {
  current: number;
  longest: number;
  /** Where the running streak began; absent when there is none. */
  currentFrom?: StreakPoint<S>;
  /** The longest run's two ends; the earliest when two tie. */
  longestFrom?: StreakPoint<S>;
  longestTo?: StreakPoint<S>;
};

/** Current run (ending at the last item) and longest run of `hit`, with where each stands. */
export function runs<T extends { at: StreakPoint<S> }, S extends string>(
  items: readonly T[],
  hit: (item: T) => boolean,
): Run<S> {
  const out: Run<S> = { current: 0, longest: 0 };
  let from: StreakPoint<S> | undefined;
  for (const item of items) {
    if (!hit(item)) {
      out.current = 0;
      from = undefined;
      continue;
    }
    from ??= item.at;
    out.current++;
    if (out.current > out.longest) {
      out.longest = out.current;
      out.longestFrom = from;
      out.longestTo = item.at;
    }
  }
  if (from) out.currentFrom = from;
  return out;
}

export type TeamGame<S extends string = string> = {
  at: StreakPoint<S>;
  result: "W" | "L" | "T" | null;
  home: boolean;
  division: boolean;
  us: number;
  them: number;
  /** The opponent's giveaways, when the game's team stats were captured. */
  takeaways: number | null;
};

export type TeamSeason<S extends string = string> = {
  at: StreakPoint<S>;
  wins: number;
  losses: number;
  playoffs: boolean;
  divisionTitle: boolean;
};

export type StreakGame<S extends string = string> = { at: StreakPoint<S>; line: StatLine };

type StreakDef<T> = {
  key: string;
  label: string;
  /** Games the streak is measured over. */
  applies: (item: T) => boolean;
  hit: (item: T) => boolean;
};

export const TEAM_STREAKS = [
  { key: "wins", label: "Wins", applies: (g) => g.result !== null, hit: (g) => g.result === "W" },
  {
    key: "homeWins",
    label: "Home wins",
    applies: (g) => g.result !== null && g.home,
    hit: (g) => g.result === "W",
  },
  {
    key: "divisionWins",
    label: "Division wins",
    applies: (g) => g.result !== null && g.division,
    hit: (g) => g.result === "W",
  },
  {
    key: "roadWins",
    label: "Road wins",
    applies: (g) => g.result !== null && !g.home,
    hit: (g) => g.result === "W",
  },
  { key: "score30", label: "Games scoring 30+", applies: (g) => g.result !== null, hit: (g) => g.us >= 30 },
  {
    key: "allowUnder20",
    label: "Games allowing under 20",
    applies: (g) => g.result !== null,
    hit: (g) => g.them < 20,
  },
  {
    key: "takeawayGames",
    label: "Games with a takeaway",
    applies: (g) => g.takeaways !== null,
    hit: (g) => (g.takeaways ?? 0) > 0,
  },
  {
    key: "oneScoreWins",
    label: "One-score wins",
    applies: (g) => g.result !== null && Math.abs(g.us - g.them) <= ONE_SCORE,
    hit: (g) => g.result === "W",
  },
] as const satisfies readonly StreakDef<TeamGame>[];

export const SEASON_STREAKS = [
  {
    key: "winningSeasons",
    label: "Winning seasons",
    applies: () => true,
    hit: (s) => s.wins > s.losses,
  },
  { key: "playoffSeasons", label: "Playoff appearances", applies: () => true, hit: (s) => s.playoffs },
  { key: "divisionTitles", label: "Division titles", applies: () => true, hit: (s) => s.divisionTitle },
  {
    key: "tenWinSeasons",
    label: "Double-digit win seasons",
    applies: () => true,
    hit: (s) => s.wins >= DOUBLE_DIGITS,
  },
] as const satisfies readonly StreakDef<TeamSeason>[];

const ONE_SCORE = 8;
const DOUBLE_DIGITS = 10;

const v = (line: StatLine, key: Parameters<typeof statValue>[0]) => statValue(key, line) ?? 0;
const touchdowns = (l: StatLine) =>
  v(l, "rushTd") + v(l, "recTd") + v(l, "defTd") + v(l, "kickReturnTd") + v(l, "puntReturnTd");

export const PLAYER_STREAKS = [
  {
    key: "rush100",
    label: "100-yard rushing games",
    applies: (l) => v(l, "rushAtt") > 0,
    hit: (l) => v(l, "rushYds") >= 100,
  },
  {
    key: "rec100",
    label: "100-yard receiving games",
    applies: (l) => v(l, "rec") > 0 || v(l, "recTargets") > 0,
    hit: (l) => v(l, "recYds") >= 100,
  },
  { key: "tdGames", label: "Games with a touchdown", applies: () => true, hit: (l) => touchdowns(l) > 0 },
  {
    key: "passTdGames",
    label: "Games with a TD pass",
    applies: (l) => v(l, "passAtt") > 0,
    hit: (l) => v(l, "passTd") > 0,
  },
  {
    key: "sackGames",
    label: "Games with a sack",
    applies: (l) => v(l, "tackles") > 0 || v(l, "sacks") > 0,
    hit: (l) => v(l, "sacks") > 0,
  },
  {
    key: "scrimmage100",
    label: "100-yard scrimmage games",
    applies: (l) => v(l, "rushAtt") > 0 || v(l, "rec") > 0,
    hit: (l) => v(l, "scrimmageYds") >= 100,
  },
  {
    key: "catchGames",
    label: "Games with a catch",
    applies: (l) => v(l, "rec") > 0 || v(l, "recTargets") > 0,
    hit: (l) => v(l, "rec") > 0,
  },
  {
    key: "recTdGames",
    label: "Games with a receiving TD",
    applies: (l) => v(l, "rec") > 0 || v(l, "recTargets") > 0,
    hit: (l) => v(l, "recTd") > 0,
  },
  {
    key: "disruptionGames",
    label: "Games with a sack or TFL",
    applies: (l) => v(l, "tackles") > 0 || v(l, "sacks") > 0,
    hit: (l) => v(l, "sacks") > 0 || v(l, "tacklesForLoss") > 0,
  },
  {
    key: "takeawayGames",
    label: "Games with a takeaway",
    applies: (l) => v(l, "tackles") > 0 || v(l, "defInt") > 0,
    hit: (l) => v(l, "defInt") > 0 || v(l, "forcedFumbles") > 0 || v(l, "fumbleRecoveries") > 0,
  },
  {
    key: "noIntGames",
    label: "Games without an interception",
    applies: (l) => v(l, "passAtt") > 0,
    hit: (l) => v(l, "passInt") === 0,
  },
  {
    key: "fgGames",
    label: "Games with a field goal",
    applies: (l) => v(l, "fga") > 0 || v(l, "xpa") > 0,
    hit: (l) => v(l, "fgm") > 0,
  },
  { key: "appearances", label: "Consecutive games played", applies: () => true, hit: () => true },
] as const satisfies readonly StreakDef<StatLine>[];

export type StreakKey =
  | (typeof TEAM_STREAKS)[number]["key"]
  | (typeof SEASON_STREAKS)[number]["key"]
  | (typeof PLAYER_STREAKS)[number]["key"];

export const STREAK_LABELS: Record<StreakKey, string> = Object.fromEntries(
  [...TEAM_STREAKS, ...SEASON_STREAKS, ...PLAYER_STREAKS].map((s) => [s.key, s.label]),
) as Record<StreakKey, string>;

/** A player's run this long is worth a milestone. */
export const PLAYER_STREAK_MARKS: ReadonlySet<number> = new Set([5, 10, 15, 20]);

/** A streak worth showing: at least two in a row at some point. */
export const MIN_STREAK = 2;

type MeasuredRun<S extends string> = Run<S> & { key: StreakKey };

function measure<B, T extends B & { at: StreakPoint<S> }, S extends string>(
  defs: readonly StreakDef<B>[],
  items: readonly T[],
): MeasuredRun<S>[] {
  return defs
    .map((def) => ({ key: def.key as StreakKey, ...runs<T, S>(items.filter(def.applies), def.hit) }))
    .filter((s) => s.longest >= MIN_STREAK);
}

export const teamStreaks = <S extends string>(games: readonly TeamGame<S>[]) =>
  measure<TeamGame, TeamGame<S>, S>(TEAM_STREAKS, games);

export const seasonStreaks = <S extends string>(seasons: readonly TeamSeason<S>[]) =>
  measure<TeamSeason, TeamSeason<S>, S>(SEASON_STREAKS, seasons);

export function playerStreaks<S extends string>(games: readonly StreakGame<S>[]): MeasuredRun<S>[] {
  return PLAYER_STREAKS.map((def) => {
    const applying = games.filter((g) => def.applies(g.line));
    return { key: def.key as StreakKey, ...runs<StreakGame<S>, S>(applying, (g) => def.hit(g.line)) };
  }).filter((s) => s.longest >= MIN_STREAK);
}
