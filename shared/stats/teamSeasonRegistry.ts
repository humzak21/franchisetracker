/**
 * The team season stat registry: the per-game and season figures Madden's team stats season
 * screen ranks across the league ("27.3 - T-3rd"). `teamSeasonStats.statKey` is one of these keys.
 */

export type TeamSeasonStatDef = { label: string; decimals: 0 | 1; better: "higher" | "lower" };

const stat = (
  label: string,
  decimals: 0 | 1 = 1,
  better: "higher" | "lower" = "higher",
): TeamSeasonStatDef => ({
  label,
  decimals,
  better,
});

export const TEAM_SEASON_STATS = {
  pointsPg: stat("Points per game"),
  yardsPg: stat("Yards per game"),
  passYardsPg: stat("Passing yards per game"),
  rushYardsPg: stat("Rushing yards per game"),
  firstDownsPg: stat("First downs per game"),
  thirdDownPct: stat("Third down conversion %"),
  redZonePct: stat("Red zone touchdown %"),
  pointsAllowedPg: stat("Points allowed per game", 1, "lower"),
  yardsAllowedPg: stat("Yards allowed per game", 1, "lower"),
  passYardsAllowedPg: stat("Passing yards allowed per game", 1, "lower"),
  rushYardsAllowedPg: stat("Rushing yards allowed per game", 1, "lower"),
  sacks: stat("Sacks", 0),
  takeaways: stat("Takeaways", 0),
  giveaways: stat("Giveaways", 0, "lower"),
  turnoverDiff: stat("Turnover differential", 0),
  penaltiesPg: stat("Penalties per game", 1, "lower"),
} as const satisfies Record<string, TeamSeasonStatDef>;

export type TeamSeasonStatKey = keyof typeof TEAM_SEASON_STATS;
export const TEAM_SEASON_STAT_KEYS = Object.keys(TEAM_SEASON_STATS) as [
  TeamSeasonStatKey,
  ...TeamSeasonStatKey[],
];

export function isTeamSeasonStatKey(key: string): key is TeamSeasonStatKey {
  return key in TEAM_SEASON_STATS;
}

export function formatTeamSeasonStat(key: TeamSeasonStatKey, value: number): string {
  return value.toFixed(TEAM_SEASON_STATS[key].decimals);
}
