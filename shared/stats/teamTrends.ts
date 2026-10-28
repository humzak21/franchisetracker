/** A team's league ranks per stat across seasons (team rank ribbons, FEATURES.md 5.1 and 7). */
import {
  formatTeamSeasonStat,
  isTeamSeasonStatKey,
  TEAM_SEASON_STAT_KEYS,
  TEAM_SEASON_STATS,
  type TeamSeasonStatKey,
} from "./teamSeasonRegistry";

/** Where a season value came from: derived from the team's games, or captured (screen or typed). */
export type TeamSeasonSource = "games" | "captured";

export type TeamSeasonRow = {
  year: number;
  statKey: string;
  value: number;
  rank?: number;
  tied?: boolean;
  source: TeamSeasonSource;
};

export type RankPoint = {
  year: number;
  value: number;
  rank: number | null;
  tied: boolean;
  source: TeamSeasonSource;
};
export type StatTrend = { statKey: TeamSeasonStatKey; points: RankPoint[] };

/** The stats the dashboard's season pulse follows. */
export const PULSE_STATS: readonly TeamSeasonStatKey[] = [
  "pointsPg",
  "yardsPg",
  "pointsAllowedPg",
  "yardsAllowedPg",
  "turnoverDiff",
];

export type CapturedSeasonRow = {
  year: number;
  statKey: string;
  value: number;
  rank?: number;
  tied?: boolean;
};

/**
 * Season values per stat: a captured value wins, else the one derived from the games. Ranks only
 * ever come from captured rows (there is no league-wide data to rank from).
 */
export function seasonRows(
  captured: readonly CapturedSeasonRow[],
  derived: readonly { year: number; stats: Partial<Record<string, number>> }[],
): TeamSeasonRow[] {
  const rows = new Map<string, TeamSeasonRow>();
  for (const { year, stats } of derived) {
    for (const [statKey, value] of Object.entries(stats)) {
      if (value !== undefined) rows.set(`${year}|${statKey}`, { year, statKey, value, source: "games" });
    }
  }
  for (const { year, statKey, value, rank, tied } of captured) {
    rows.set(`${year}|${statKey}`, { year, statKey, value, rank, tied, source: "captured" });
  }
  return [...rows.values()];
}

/** Rows grouped per registry stat, seasons ascending, in registry order; unknown keys are dropped. */
export function rankTrends(rows: readonly TeamSeasonRow[]): StatTrend[] {
  const byStat = new Map<TeamSeasonStatKey, RankPoint[]>();
  for (const row of rows) {
    if (!isTeamSeasonStatKey(row.statKey)) continue;
    const point = {
      year: row.year,
      value: row.value,
      rank: row.rank ?? null,
      tied: row.tied ?? false,
      source: row.source,
    };
    byStat.set(row.statKey, [...(byStat.get(row.statKey) ?? []), point]);
  }
  return TEAM_SEASON_STAT_KEYS.flatMap((statKey) => {
    const points = byStat.get(statKey);
    return points ? [{ statKey, points: points.sort((a, b) => a.year - b.year) }] : [];
  });
}

/**
 * Rank movement into a season from the previous ranked one: positive is better (12th → 5th is
 * a climb of 7). Null when that season or an earlier one has no rank.
 */
export function rankChange(
  points: readonly { year: number; rank: number | null }[],
  year: number,
): { climb: number; from: number } | null {
  const ranked = points.filter((p) => p.rank !== null && p.year <= year);
  const [before, current] = ranked.slice(-2);
  if (!before || !current || current.year !== year || before.rank === null || current.rank === null) {
    return null;
  }
  return { climb: before.rank - current.rank, from: before.year };
}

/** Trends as labelled rows with registry-formatted values, for `RankTrend`; optionally only some stats. */
export function trendRows(trends: readonly StatTrend[], only?: readonly TeamSeasonStatKey[]) {
  return trends
    .filter((t) => !only || only.includes(t.statKey))
    .map((t) => ({
      key: t.statKey,
      label: TEAM_SEASON_STATS[t.statKey].label,
      points: t.points.map((p) => ({ ...p, value: formatTeamSeasonStat(t.statKey, p.value) })),
    }));
}
