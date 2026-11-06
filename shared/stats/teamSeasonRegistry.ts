/**
 * The team season stat registry: the per-game and season figures Madden's team stats season
 * screen ranks across the league ("27.3 - T-3rd"). `teamSeasonStats.statKey` is one of these keys.
 */

/** The side of the ball a stat belongs to, for grouping the Team stats view. */
export const TEAM_SEASON_GROUPS = [
  { key: "offense", label: "Offense" },
  { key: "defense", label: "Defense" },
  { key: "ball", label: "Turnovers and discipline" },
] as const;
export type TeamSeasonGroup = (typeof TEAM_SEASON_GROUPS)[number]["key"];

export type TeamSeasonStatDef = {
  label: string;
  group: TeamSeasonGroup;
  decimals: 0 | 1;
  better: "higher" | "lower";
  /** A season total rather than a rate, so a season still being played is not comparable yet. */
  total: boolean;
};

const stat = (
  label: string,
  group: TeamSeasonGroup,
  decimals: 0 | 1 = 1,
  better: "higher" | "lower" = "higher",
): TeamSeasonStatDef => ({
  label,
  group,
  decimals,
  better,
  total: false,
});

const total = (
  label: string,
  group: TeamSeasonGroup,
  better: "higher" | "lower" = "higher",
): TeamSeasonStatDef => ({ ...stat(label, group, 0, better), total: true });

export const TEAM_SEASON_STATS = {
  pointsPg: stat("Points per game", "offense"),
  yardsPg: stat("Yards per game", "offense"),
  passYardsPg: stat("Passing yards per game", "offense"),
  rushYardsPg: stat("Rushing yards per game", "offense"),
  firstDownsPg: stat("First downs per game", "offense"),
  thirdDownPct: stat("Third down conversion %", "offense"),
  redZonePct: stat("Red zone touchdown %", "offense"),
  pointsAllowedPg: stat("Points allowed per game", "defense", 1, "lower"),
  yardsAllowedPg: stat("Yards allowed per game", "defense", 1, "lower"),
  passYardsAllowedPg: stat("Passing yards allowed per game", "defense", 1, "lower"),
  rushYardsAllowedPg: stat("Rushing yards allowed per game", "defense", 1, "lower"),
  sacks: total("Sacks", "defense"),
  takeaways: total("Takeaways", "ball"),
  giveaways: total("Giveaways", "ball", "lower"),
  turnoverDiff: total("Turnover differential", "ball"),
  penaltiesPg: stat("Penalties per game", "ball", 1, "lower"),
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
