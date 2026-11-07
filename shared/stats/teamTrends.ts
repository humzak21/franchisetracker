/** A team's league ranks per stat across seasons (team rank ribbons, FEATURES.md 5.1 and 7). */
import {
  formatTeamSeasonStat,
  isTeamSeasonStatKey,
  TEAM_SEASON_STAT_KEYS,
  TEAM_SEASON_STATS,
  type TeamSeasonStatKey,
} from "./teamSeasonRegistry";

/**
 * Where a season value came from: derived from the team's games, read from the league team stats
 * screen (League → Teams), or captured from the team's own season screen or typed in.
 */
export type TeamSeasonSource = "games" | "league" | "captured";

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

type SeasonStats = { year: number; stats: Partial<Record<string, number>> };

/**
 * Season values per stat: a captured value wins, then the league team stats screen's, then the
 * one derived from the games. Ranks here only come from captured rows; `teamSeasonLeague` works
 * out the rest from League → Teams.
 */
export function seasonRows(
  captured: readonly CapturedSeasonRow[],
  derived: readonly SeasonStats[],
  league: readonly SeasonStats[] = [],
): TeamSeasonRow[] {
  const rows = new Map<string, TeamSeasonRow>();
  for (const [layer, source] of [
    [derived, "games"],
    [league, "league"],
  ] as const) {
    for (const { year, stats } of layer) {
      for (const [statKey, value] of Object.entries(stats)) {
        if (value !== undefined) rows.set(`${year}|${statKey}`, { year, statKey, value, source });
      }
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
