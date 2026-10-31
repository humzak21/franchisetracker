export const MILESTONE_KINDS = [
  "career_high",
  "threshold_game",
  "first_threshold_season",
  "franchise_record",
  "streak",
  "first_td",
  "game_winner",
  "connection",
  "mark",
  "player_streak",
  "team_record",
  "custom",
] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];
