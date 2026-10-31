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

/** The kinds that mean a record fell, as the digest and the recap lead with them. */
export const RECORD_MILESTONES: readonly MilestoneKind[] = ["franchise_record", "team_record"];
