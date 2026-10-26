/**
 * Week keys, playoff rounds and lifecycle statuses for seasons and games.
 * Week keys are ordered: `WEEK_KEYS` index order is chronological order.
 */

const PRESEASON = ["pre1", "pre2", "pre3"] as const;
const REGULAR = [
  "w1",
  "w2",
  "w3",
  "w4",
  "w5",
  "w6",
  "w7",
  "w8",
  "w9",
  "w10",
  "w11",
  "w12",
  "w13",
  "w14",
  "w15",
  "w16",
  "w17",
  "w18",
] as const;
export const PLAYOFF_ROUNDS = ["wc", "div", "conf", "sb"] as const;

export const WEEK_KEYS = [...PRESEASON, ...REGULAR, ...PLAYOFF_ROUNDS, "probowl"] as const;
export type WeekKey = (typeof WEEK_KEYS)[number];
export type PlayoffRound = (typeof PLAYOFF_ROUNDS)[number];
export type WeekPhase = "preseason" | "regular" | "postseason" | "allstar";

export const PLAYOFF_ROUND_LABELS: Record<PlayoffRound, { short: string; long: string }> = {
  wc: { short: "WC", long: "Wild Card" },
  div: { short: "DIV", long: "Divisional" },
  conf: { short: "CONF", long: "Conference Championship" },
  sb: { short: "SB", long: "Super Bowl" },
};

export function isWeekKey(value: string): value is WeekKey {
  return (WEEK_KEYS as readonly string[]).includes(value);
}

export function isPlayoffRound(value: string): value is PlayoffRound {
  return (PLAYOFF_ROUNDS as readonly string[]).includes(value);
}

const REGULAR_WEEK = /^w\d+$/;
const PRESEASON_WEEK = /^pre\d+$/;

export function weekPhase(week: WeekKey): WeekPhase {
  if (PRESEASON_WEEK.test(week)) return "preseason";
  // Not `startsWith("w")`: the Wild Card key is "wc".
  if (REGULAR_WEEK.test(week)) return "regular";
  if (week === "probowl") return "allstar";
  return "postseason";
}

export function weekIndex(week: WeekKey): number {
  return WEEK_KEYS.indexOf(week);
}

export function weekLabel(week: WeekKey, style: "short" | "long" = "short"): string {
  if (PRESEASON_WEEK.test(week))
    return style === "short" ? `P${week.slice(3)}` : `Preseason ${week.slice(3)}`;
  if (REGULAR_WEEK.test(week)) return style === "short" ? `W${week.slice(1)}` : `Week ${week.slice(1)}`;
  if (week === "probowl") return "Pro Bowl";
  return PLAYOFF_ROUND_LABELS[week as PlayoffRound][style];
}

/** Next or previous week key in calendar order, or null at either end. */
export function adjacentWeek(week: WeekKey, direction: 1 | -1): WeekKey | null {
  return WEEK_KEYS[weekIndex(week) + direction] ?? null;
}

export const SEASON_STATUSES = ["upcoming", "regular", "postseason", "complete"] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number];

export const GAME_STATUSES = ["scheduled", "played", "bye"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_RESULTS = ["W", "L", "T"] as const;
export type GameResult = (typeof GAME_RESULTS)[number];

/** Where a season ended for a team. */
export const PLAYOFF_RESULTS = ["missed", "wc_loss", "div_loss", "conf_loss", "sb_loss", "champion"] as const;
export type PlayoffResult = (typeof PLAYOFF_RESULTS)[number];

export const PLAYOFF_RESULT_LABELS: Record<PlayoffResult, string> = {
  missed: "Missed playoffs",
  wc_loss: "Lost Wild Card",
  div_loss: "Lost Divisional",
  conf_loss: "Lost Conference",
  sb_loss: "Lost Super Bowl",
  champion: "Won Super Bowl",
};
