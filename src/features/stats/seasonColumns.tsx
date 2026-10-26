/** Rows and registry-driven columns for one position group of the season stats table. */
import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { positionGroupOf } from "@shared/domain";
import {
  aggregateLines,
  CAREER_HIGH_STATS,
  GAME_THRESHOLDS,
  getStat,
  RAW_STATS,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsInCategory,
  statsWithData,
  statValue,
  type StatGroup,
  type StatKey,
  type StatLine,
  type ThresholdOverrides,
} from "@shared/stats";
import { statColumn, type DataColumn } from "@/components/data/DataTable";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { TeamLike } from "@/components/team/TeamLogo";

export type SeasonStatRow = FunctionReturnType<typeof api.stats.season.bySplit>[number];

export type Row = {
  id: string;
  playerId: string | null;
  name: string;
  position: string;
  jersey: number | null;
  games: number | null;
  line: StatLine;
  counts: Record<string, number>;
  bests: Record<string, number>;
};

/** Players in the group: by season position, or anyone with stats in the group's categories. */
export function groupRows(rows: readonly SeasonStatRow[], group: StatGroup): Row[] {
  const keys = group.categories.flatMap((c) => statsInCategory(c));
  return rows
    .filter((r) => {
      if (group.positions) return group.positions.includes(r.positionGroup ?? positionGroupOf(r.position));
      return keys.some((k) => (statValue(k, r.totals as StatLine) ?? 0) !== 0);
    })
    .map((r) => ({
      id: r.playerId,
      playerId: r.playerId,
      name: r.name,
      position: r.position,
      jersey: r.jersey,
      games: r.gamesPlayed,
      line: r.totals as StatLine,
      counts: r.thresholdCounts,
      bests: r.bests,
    }));
}

export function totalsRow(rows: readonly Row[]): Row {
  return {
    id: "totals",
    playerId: null,
    name: "Team",
    position: "",
    jersey: null,
    // The team played as many games as its busiest player, so per-game rates stay meaningful.
    games: Math.max(0, ...rows.map((r) => r.games ?? 0)),
    line: aggregateLines(rows.map((r) => r.line)),
    counts: {},
    bests: {},
  };
}

/** Threshold games for the group's categories that someone reached ("100-yard games"). */
function countColumns(group: StatGroup, rows: readonly Row[]): DataColumn<Row>[] {
  return GAME_THRESHOLDS.filter(
    (t) =>
      group.categories.includes(STAT_REGISTRY[t.stat].category) &&
      rows.some((r) => (r.counts[t.key] ?? 0) > 0),
  ).map((t) => ({
    id: `count-${t.key}`,
    header: t.short,
    title: t.label,
    group: "Big games",
    align: "right",
    sortable: true,
    sortDescFirst: true,
    value: (r) => (r.id === "totals" ? null : (r.counts[t.key] ?? 0)),
    cell: (r) => <span className="num">{r.id === "totals" ? "" : (r.counts[t.key] ?? 0)}</span>,
  }));
}

/** Best single game for the group's headline stats. */
function bestColumns(group: StatGroup, rows: readonly Row[], stats: readonly StatKey[]): DataColumn<Row>[] {
  return CAREER_HIGH_STATS.filter(
    (k) =>
      stats.includes(k) && group.categories.includes(RAW_STATS[k].category) && rows.some((r) => r.bests[k]),
  ).map((k) => ({
    ...statColumn<Row>(k, (r) => (r.id === "totals" ? null : (r.bests[k] ?? null)), { highlight: false }),
    id: `best-${k}`,
    title: `Best game: ${getStat(k).label}`,
    group: "Best game",
  }));
}

export function seasonColumns(
  group: StatGroup,
  rows: readonly Row[],
  team: TeamLike,
  thresholds: ThresholdOverrides | undefined,
): { columns: DataColumn<Row>[]; stats: StatKey[] } {
  const stats = statsWithData(
    group.categories,
    rows.map((r) => ({ line: r.line, games: r.games ?? 1 })),
  );
  const player: DataColumn<Row> = {
    id: "player",
    header: "Player",
    value: (r) => r.name,
    searchable: true,
    sortable: false,
    minWidth: 170,
    cell: (r) =>
      r.playerId === null ? (
        <span className="font-semibold">Team</span>
      ) : (
        <Link to="/players/$playerId" params={{ playerId: r.playerId }} className="hover:underline">
          <PlayerChip
            size="sm"
            player={{ displayName: r.name, position: r.position, jersey: r.jersey, team }}
          />
        </Link>
      ),
  };
  const games: DataColumn<Row> = {
    id: "gp",
    header: "GP",
    title: "Games played",
    align: "right",
    sortDescFirst: true,
    value: (r) => (r.playerId === null ? null : r.games),
  };
  const statCols = stats.map((key) => {
    const value = (r: Row) => statValue(key, r.line, { games: r.games ?? 1 });
    return statColumn<Row>(key, value, {
      group: STAT_CATEGORY_LABELS[STAT_REGISTRY[key].category],
      thresholds,
    });
  });
  return {
    columns: [player, games, ...statCols, ...countColumns(group, rows), ...bestColumns(group, rows, stats)],
    stats,
  };
}
