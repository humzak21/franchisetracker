import { useMemo } from "react";
import {
  CATEGORY_PRIMARY,
  categoriesPlayed,
  STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statValue,
  type StatCategory,
  type StatKey,
  type ThresholdOverrides,
} from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { StatCard, type StatCardGroup } from "@/components/data/StatCard";
import { careerRows, totalsRow, visibleStats, type CareerRow } from "./careerStats";
import type { PlayerPage } from "./types";

/** At most this many categories per card: the player's own come first. */
const MAX_GROUPS = 3;

function groupsFor(
  stats: readonly StatKey[],
  row: CareerRow,
  trendRows?: readonly CareerRow[],
): StatCardGroup[] {
  const recorded = categoriesPlayed(STAT_CATEGORIES, row.line);
  const categories = [...new Set(stats.map((k) => STAT_REGISTRY[k].category))]
    .filter((c) => recorded.includes(c))
    .slice(0, MAX_GROUPS);
  return categories.map((category: StatCategory) => ({
    title: STAT_CATEGORY_LABELS[category],
    items: CATEGORY_PRIMARY[category]
      .filter((k) => stats.includes(k))
      .map((stat) => ({
        stat,
        value: statValue(stat, row.line, { games: row.games }),
        trend: trendRows?.map((r) => statValue(stat, r.line, { games: r.games })),
      })),
  }));
}

/** The latest season and the career as stat cards, the career one with a trend per stat. */
export function PlayerStatCards({ page }: { page: PlayerPage }) {
  const thresholds = useFranchise()?.franchise.settings.thresholdOverrides as ThresholdOverrides | undefined;
  const position = page.history[page.history.length - 1]?.entry.position ?? page.player.position;
  const { latest, career, rows, stats } = useMemo(() => {
    const rows = careerRows(page.seasons, "regular");
    return {
      rows,
      latest: rows[rows.length - 1],
      career: totalsRow(rows),
      stats: visibleStats(position, rows),
    };
  }, [page.seasons, position]);
  if (!latest || stats.length === 0) return null;

  return (
    <div className="@container grid gap-3 @desktop:grid-cols-2">
      <StatCard
        title={`${latest.year} season`}
        subtitle={`${latest.teamAbbr} · ${latest.games} games${latest.imported ? " · real NFL" : ""}`}
        groups={groupsFor(stats, latest)}
        thresholds={thresholds}
      />
      <StatCard
        title="Career"
        subtitle={`${new Set(rows.map((r) => r.year)).size} seasons · ${career.games} games`}
        groups={groupsFor(stats, career, rows.length > 1 ? rows : undefined)}
        highlight={false}
      />
    </div>
  );
}
