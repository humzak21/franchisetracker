import type { TargetKey } from "@shared/ingestion/targets";

/**
 * Where a committed manual entry lands when it wrote no single game or player: the screen that
 * shows what was entered, so the user sees it in place.
 */
const LANDING = {
  game_log: "/schedule",
  game_box_score: "/schedule",
  team_game_stats: "/schedule",
  scoring_plays: "/schedule",
  season_player_stats: "/stats/reconcile",
  league_leaders: "/stats",
  records_list: "/stats",
  team_history: "/history",
  team_season_stats: "/stats",
  league_team_stats: "/stats",
  standings: "/league",
  league_schedule: "/league",
  weekly_awards: "/awards",
  yearly_awards: "/awards",
  draft_results: "/draft",
  roster_page: "/roster",
  transactions: "/transactions",
  injury_report: "/transactions",
  player_card: "/roster",
} as const satisfies Record<TargetKey, string>;

export function landingFor(target: TargetKey) {
  return LANDING[target];
}
