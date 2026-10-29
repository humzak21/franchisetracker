/**
 * The user team's record for one season as typed or read for History (FEATURES.md 5.7): the
 * checks every hand-entered season passes, and the Super Bowl a season's champion won. Pure.
 */
import { PLAYOFF_RESULT_LABELS, type PlayoffResult } from "../domain/calendar";
import type { Tier } from "../stats/thresholds";

export type SeasonRecordInput = {
  w: number;
  l: number;
  t: number;
  divisionRank?: number;
  seed?: number;
  playoffResult?: PlayoffResult;
};

/** The longest regular season so far (17 games); the earliest had as few as 9. */
const MAX_GAMES = 17;
/** Before the 1970 merger a division (then a conference) could hold up to eight teams. */
const MAX_DIVISION_RANK = 8;
const MAX_SEED = 7;

const count = (n: number) => Number.isInteger(n) && n >= 0;
const within = (n: number | undefined, max: number) =>
  n === undefined || (Number.isInteger(n) && n >= 1 && n <= max);

/** Why a season's record cannot be saved, or null when it can. */
export function seasonRecordError(record: SeasonRecordInput): string | null {
  const { w, l, t } = record;
  if (![w, l, t].every(count)) return "Wins, losses and ties are whole numbers, zero or more";
  const games = w + l + t;
  if (games === 0) return "Enter the season's record";
  if (games > MAX_GAMES) return `${games} games is more than a season (${MAX_GAMES} at most)`;
  if (!within(record.divisionRank, MAX_DIVISION_RANK))
    return `Division finish runs from 1 to ${MAX_DIVISION_RANK}`;
  if (!within(record.seed, MAX_SEED)) return `Seeds run from 1 to ${MAX_SEED}`;
  return null;
}

/** Super Bowl I closed the 1966 season; each game is numbered by the season it ends. */
const FIRST_SUPER_BOWL_SEASON = 1966;

const NUMERALS: [number, string][] = [
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function roman(n: number): string {
  let out = "";
  let left = n;
  for (const [value, numeral] of NUMERALS) {
    while (left >= value) {
      out += numeral;
      left -= value;
    }
  }
  return out;
}

/**
 * The Super Bowl that decided a season ("Super Bowl LI" for 2016), or null before there was one.
 * The 2015 season's game was billed as Super Bowl 50, the one without a numeral.
 */
export function superBowlName(seasonYear: number): string | null {
  const n = seasonYear - FIRST_SUPER_BOWL_SEASON + 1;
  if (n < 1) return null;
  return `Super Bowl ${n === 50 ? "50" : roman(n)}`;
}

/**
 * How History marks a season's finish, in the stat highlight tiers: a division title and the
 * top seed stand out, a Super Bowl win stands out most.
 */
export function finishTiers(record: Pick<SeasonRecordInput, "divisionRank" | "seed" | "playoffResult">): {
  division: Tier;
  seed: Tier;
  playoffs: Tier;
} {
  return {
    division: record.divisionRank === 1 ? 1 : 0,
    seed: record.seed === 1 ? 1 : 0,
    playoffs: record.playoffResult === "champion" ? 2 : 0,
  };
}

/**
 * The playoff result as History prints it, naming the Super Bowl a champion won; a champion from
 * before the Super Bowl won the NFL title.
 */
export function playoffFinishLabel(result: PlayoffResult, seasonYear: number): string {
  if (result !== "champion") return PLAYOFF_RESULT_LABELS[result];
  const game = superBowlName(seasonYear);
  return game ? `Won ${game}` : "Won NFL title";
}
