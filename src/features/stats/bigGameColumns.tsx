/** The season table's big-game counts and season highs (best single game per stat, with its week). */
import {
  gameThreshold,
  getStat,
  SEASON_HIGH_STATS,
  STAT_CATEGORY_LABELS,
  type StatGroup,
  type StatKey,
} from "@shared/stats";
import type { DataColumn } from "@/components/data/DataTable";
import { SeasonHighCell } from "./SeasonHighCell";
import type { Row } from "./seasonRows";

/** The group's threshold-game counts. Always shown, zeros included, so every player reads the same. */
export function countColumns(group: StatGroup): DataColumn<Row>[] {
  return group.counts.map((key) => {
    const t = gameThreshold(key);
    const count = (r: Row) => (r.playerId === null ? null : (r.counts[t.key] ?? 0));
    return {
      id: `count-${t.key}`,
      header: t.header,
      title: `Big games: ${t.label.toLowerCase()}`,
      group: "Big games",
      align: "right",
      sortable: true,
      sortDescFirst: true,
      value: count,
      cell: (r) => <span className="num">{count(r)}</span>,
    };
  });
}

/** One column per shown stat that has a meaningful best game, grouped by category ("Rushing highs"). */
export function highColumns(stats: readonly StatKey[], rows: readonly Row[]): DataColumn<Row>[] {
  return stats
    .filter((k) => SEASON_HIGH_STATS.includes(k) && rows.some((r) => r.highs[k]))
    .map((k) => {
      const def = getStat(k);
      return {
        id: `high-${k}`,
        header: def.abbr,
        title: `Season high: ${def.label.toLowerCase()}`,
        group: `${STAT_CATEGORY_LABELS[def.category]} highs`,
        align: "right",
        sortable: true,
        sortDescFirst: true,
        value: (r) => r.highs[k]?.value ?? null,
        cell: (r) => (r.playerId === null ? null : <SeasonHighCell stat={k} high={r.highs[k]} />),
      };
    });
}
