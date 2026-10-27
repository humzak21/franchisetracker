/**
 * Pre-season goals (FEATURES.md 5.11): what the team or a player should reach this season.
 * Team goals are read off the season's record and playoff run; player goals off a stat total;
 * write-ins are marked hit or missed by hand.
 */

export const GOAL_SCOPES = ["team", "player"] as const;
export type GoalScope = (typeof GOAL_SCOPES)[number];

export const GOAL_TYPES = [
  "wins",
  "division",
  "playoffs",
  "bye",
  "playoff_win",
  "super_bowl_appearance",
  "super_bowl_win",
  "stat",
  "custom",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** Team goal types, in the order the goal picker lists them. */
export const TEAM_GOAL_TYPES = [
  "wins",
  "division",
  "playoffs",
  "bye",
  "playoff_win",
  "super_bowl_appearance",
  "super_bowl_win",
  "custom",
] as const satisfies readonly GoalType[];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  wins: "Win at least",
  division: "Win the division",
  playoffs: "Make the playoffs",
  bye: "Earn a first-round bye",
  playoff_win: "Win a playoff game",
  super_bowl_appearance: "Reach the Super Bowl",
  super_bowl_win: "Win the Super Bowl",
  stat: "Reach a stat",
  custom: "Write in",
};

export const GOAL_OUTCOMES = ["hit", "missed"] as const;
export type GoalOutcome = (typeof GOAL_OUTCOMES)[number];
