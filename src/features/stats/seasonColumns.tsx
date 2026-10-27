/** Registry-driven columns for one position group of the season stats table. */
import { Link } from "@tanstack/react-router";
import {
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsWithData,
  statValue,
  type StatGroup,
  type StatKey,
  type ThresholdOverrides,
} from "@shared/stats";
import { statColumn, type DataColumn } from "@/components/data/DataTable";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { TeamLike } from "@/components/team/TeamLogo";
import { countColumns, highColumns } from "./bigGameColumns";
import type { Row } from "./seasonRows";

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
    columns: [player, games, ...statCols, ...countColumns(group), ...highColumns(stats, rows)],
    stats,
  };
}
