/** How points are scored in a game: the kinds of play on Madden's scoring summary and what follows a touchdown. */

export const SCORING_KINDS = [
  "pass_td",
  "rush_td",
  "fg",
  "safety",
  "int_td",
  "fumble_td",
  "kick_return_td",
  "punt_return_td",
  "blocked_kick_td",
  "other",
] as const;
export type ScoringKind = (typeof SCORING_KINDS)[number];

export const SCORING_KIND_LABELS: Record<ScoringKind, string> = {
  pass_td: "Passing touchdown",
  rush_td: "Rushing touchdown",
  fg: "Field goal",
  safety: "Safety",
  int_td: "Interception return touchdown",
  fumble_td: "Fumble return touchdown",
  kick_return_td: "Kick return touchdown",
  punt_return_td: "Punt return touchdown",
  blocked_kick_td: "Blocked kick touchdown",
  other: "Other score",
};

/** The play's name in a description: "15 yd pass", "42 yd field goal". */
export const SCORING_KIND_PLAYS: Record<ScoringKind, string> = {
  pass_td: "pass",
  rush_td: "run",
  fg: "field goal",
  safety: "safety",
  int_td: "interception return",
  fumble_td: "fumble return",
  kick_return_td: "kick return",
  punt_return_td: "punt return",
  blocked_kick_td: "blocked kick return",
  other: "score",
};

const TOUCHDOWNS: ReadonlySet<ScoringKind> = new Set([
  "pass_td",
  "rush_td",
  "int_td",
  "fumble_td",
  "kick_return_td",
  "punt_return_td",
  "blocked_kick_td",
]);

export const isTouchdown = (kind: ScoringKind) => TOUCHDOWNS.has(kind);

export const PAT_RESULTS = ["kick", "kick_failed", "two", "two_failed", "none"] as const;
export type PatResult = (typeof PAT_RESULTS)[number];

export const PAT_LABELS: Record<PatResult, string> = {
  kick: "Kick good",
  kick_failed: "Kick missed",
  two: "Two-point try good",
  two_failed: "Two-point try failed",
  none: "No try",
};

const PAT_POINTS: Record<PatResult, number> = { kick: 1, kick_failed: 0, two: 2, two_failed: 0, none: 0 };

/** The points a play is worth, or null when the screen does not settle it (an unknown try, `other`). */
export function playPoints(kind: ScoringKind, pat: PatResult | null): number | null {
  if (kind === "fg") return 3;
  if (kind === "safety") return 2;
  if (!isTouchdown(kind)) return null;
  return pat === null ? null : 6 + PAT_POINTS[pat];
}

/** What a score could be worth with no reading of the try: a touchdown is 6, 7 or 8. */
export function plausiblePoints(kind: ScoringKind): readonly number[] {
  if (kind === "fg") return [3];
  if (kind === "safety") return [2];
  return isTouchdown(kind) ? [6, 7, 8] : [1, 2, 3, 6, 7, 8];
}

/** Periods as the scoring summary prints them, in game order. */
export const SCORING_PERIODS = ["1", "2", "3", "4", "OT", "OT2"] as const;
export type ScoringPeriod = (typeof SCORING_PERIODS)[number];

/** 1 to 4 for the quarters, 5 and up for overtime. */
export const periodNumber = (period: ScoringPeriod): number => SCORING_PERIODS.indexOf(period) + 1;
