/**
 * Streaks (FEATURES.md 5.5): team runs over the franchise's games and player runs over the
 * games a player appeared in, both oldest first. A streak counts only the games it applies to:
 * a home win streak skips road games rather than ending on them.
 */
import { statValue } from "./aggregate";
import type { StatLine } from "./registry";

export type Run = { current: number; longest: number };

/** Current run (ending at the last item) and longest run of `true`. */
export function runs(flags: readonly boolean[]): Run {
  let current = 0;
  let longest = 0;
  for (const flag of flags) {
    current = flag ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return { current, longest };
}

export type TeamGame = { result: "W" | "L" | "T" | null; home: boolean; division: boolean };

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
] as const satisfies readonly StreakDef<TeamGame>[];

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
] as const satisfies readonly StreakDef<StatLine>[];

export type StreakKey = (typeof TEAM_STREAKS)[number]["key"] | (typeof PLAYER_STREAKS)[number]["key"];

export const STREAK_LABELS: Record<StreakKey, string> = Object.fromEntries(
  [...TEAM_STREAKS, ...PLAYER_STREAKS].map((s) => [s.key, s.label]),
) as Record<StreakKey, string>;

/** A streak worth showing: at least two in a row at some point. */
export const MIN_STREAK = 2;

function measure<T>(defs: readonly StreakDef<T>[], items: readonly T[]) {
  return defs
    .map((def) => ({ key: def.key as StreakKey, ...runs(items.filter(def.applies).map(def.hit)) }))
    .filter((s) => s.longest >= MIN_STREAK);
}

export const teamStreaks = (games: readonly TeamGame[]) => measure(TEAM_STREAKS, games);
export const playerStreaks = (lines: readonly StatLine[]) => measure(PLAYER_STREAKS, lines);
