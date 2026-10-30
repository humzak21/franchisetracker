/** Registry-driven columns for one position group of the season stats table. */
import { Link } from "@tanstack/react-router";
import {
  formatStat,
  isRawStatKey,
  loggedValue,
  RAW_STATS,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsWithData,
  statValue,
  type StatGroup,
  type StatKey,
  type StatLine,
  type ThresholdOverrides,
} from "@shared/stats";
import { MISSING_GAME_NOTE } from "@shared/ingestion/reconcile";
import { editableStat, statColumn, type DataColumn } from "@/components/data/DataTable";
import { DeltaBadge } from "@/components/data/DeltaBadge";
import { StatCell } from "@/components/data/StatCell";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { TeamLike } from "@/components/team/TeamLogo";
import { countColumns, highColumns } from "./bigGameColumns";
import type { Row } from "./seasonRows";

const isSummed = (key: StatKey) => isRawStatKey(key) && RAW_STATS[key].aggregation === "sum";

export function seasonColumns(
  group: StatGroup,
  rows: readonly Row[],
  team: TeamLike,
  thresholds: ThresholdOverrides | undefined,
  /** Last season's rows: each number then shows its change from the same player's. */
  lastYear?: readonly { playerId: string; totals: StatLine }[],
): { columns: DataColumn<Row>[]; stats: StatKey[] } {
  const before = new Map(lastYear?.map((r) => [r.playerId, r.totals]));
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
            player={{
              displayName: r.name,
              position: r.position,
              jersey: r.jersey,
              headshotUrl: r.headshotUrl,
              team,
            }}
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
    edit: { kind: "number", get: (r) => r.games, min: 0, max: 25 },
  };
  const statCols = stats.map((key) => {
    const value = (r: Row) => statValue(key, r.line, { games: r.games ?? 1 });
    const column = statColumn<Row>(key, value, {
      group: STAT_CATEGORY_LABELS[STAT_REGISTRY[key].category],
      thresholds,
      note: (r) => (r.overridden.includes(key) ? MISSING_GAME_NOTE : undefined),
    });
    // Rates do not subtract, so a change is shown only for numbers that add up.
    if (!lastYear || !isSummed(key)) return editableStat(column, key, (r) => r.line);
    const delta = (r: Row) => {
      const earlier = r.playerId ? before.get(r.playerId) : undefined;
      return earlier ? loggedValue(key, r.line) - loggedValue(key, earlier) : null;
    };
    const cell = (r: Row) => (
      <span className="inline-flex items-baseline gap-1.5">
        <StatCell stat={key} value={value(r)} thresholds={thresholds} />
        <DeltaBadge delta={delta(r)} better={STAT_REGISTRY[key].better} format={(n) => formatStat(key, n)} />
      </span>
    );
    return { ...column, cell };
  });
  return {
    columns: [player, games, ...statCols, ...countColumns(group), ...highColumns(stats, rows)],
    stats,
  };
}
