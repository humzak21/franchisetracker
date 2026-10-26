/** A team's league ranks per stat across seasons (team rank ribbons, FEATURES.md 5.1 and 7). */
import { isTeamSeasonStatKey, TEAM_SEASON_STAT_KEYS, type TeamSeasonStatKey } from "./teamSeasonRegistry";

export type TeamSeasonRow = { year: number; statKey: string; value: number; rank?: number; tied?: boolean };

export type RankPoint = { year: number; value: number; rank: number | null; tied: boolean };
export type StatTrend = { statKey: TeamSeasonStatKey; points: RankPoint[] };

/** The stats the dashboard's season pulse follows. */
export const PULSE_STATS: readonly TeamSeasonStatKey[] = [
  "pointsPg",
  "yardsPg",
  "pointsAllowedPg",
  "yardsAllowedPg",
  "turnoverDiff",
];

/** Rows grouped per registry stat, seasons ascending, in registry order; unknown keys are dropped. */
export function rankTrends(rows: readonly TeamSeasonRow[]): StatTrend[] {
  const byStat = new Map<TeamSeasonStatKey, RankPoint[]>();
  for (const row of rows) {
    if (!isTeamSeasonStatKey(row.statKey)) continue;
    const point = { year: row.year, value: row.value, rank: row.rank ?? null, tied: row.tied ?? false };
    byStat.set(row.statKey, [...(byStat.get(row.statKey) ?? []), point]);
  }
  return TEAM_SEASON_STAT_KEYS.flatMap((statKey) => {
    const points = byStat.get(statKey);
    return points ? [{ statKey, points: points.sort((a, b) => a.year - b.year) }] : [];
  });
}

/** Rank movement from the previous season to the latest: positive is better (12th → 5th is +7). */
export function rankChange(points: readonly RankPoint[]): number | null {
  const [before, latest] = points.filter((p) => p.rank !== null).slice(-2);
  if (!before || !latest || before.rank === null || latest.rank === null) return null;
  return before.rank - latest.rank;
}
