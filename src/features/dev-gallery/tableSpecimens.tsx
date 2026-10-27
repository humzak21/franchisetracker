import { Inbox } from "lucide-react";
import { statValue } from "@shared/stats";
import { DataTable, statColumn, type DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { PlayerChip } from "@/components/player/PlayerChip";
import { RECEIVERS_2025, type ReceiverRow } from "./fixtures";
import type { Specimen } from "./specimens";

const s = (row: ReceiverRow, key: Parameters<typeof statValue>[0]) =>
  statValue(key, row.stats, { games: row.games });

const RECEIVER_COLUMNS: DataColumn<ReceiverRow>[] = [
  {
    id: "player",
    header: "Player",
    value: (r) => r.player.displayName,
    searchable: true,
    sortable: false,
    minWidth: 180,
    cell: (r) =>
      r.id === "totals" ? (
        <span className="font-semibold">Team totals</span>
      ) : (
        <PlayerChip player={r.player} size="sm" />
      ),
  },
  {
    id: "gp",
    header: "GP",
    title: "Games played",
    value: (r) => r.games,
    align: "right",
    group: "Games",
    sortDescFirst: true,
  },
  statColumn("rec", (r) => s(r, "rec"), { group: "Receiving" }),
  statColumn("recTargets", (r) => s(r, "recTargets"), { group: "Receiving", highlight: false }),
  statColumn("recYds", (r) => s(r, "recYds"), { group: "Receiving" }),
  statColumn("recTd", (r) => s(r, "recTd"), { group: "Receiving" }),
  statColumn("recAvg", (r) => s(r, "recAvg"), { group: "Receiving" }),
  statColumn("recYpg", (r) => s(r, "recYpg"), { group: "Receiving" }),
  statColumn("recLong", (r) => s(r, "recLong"), { group: "Receiving" }),
  {
    id: "g100",
    header: "100+",
    title: "100-yard games",
    value: (r) => r.games100,
    align: "right",
    group: "Threshold games",
    sortDescFirst: true,
  },
  {
    id: "g5",
    header: "5+",
    title: "5+ catch games",
    value: (r) => r.games5rec,
    align: "right",
    group: "Threshold games",
    sortDescFirst: true,
  },
];

const RECEIVER_TOTALS: ReceiverRow = {
  id: "totals",
  player: { displayName: "Team totals", position: "" },
  games: 17,
  stats: RECEIVERS_2025.reduce(
    (acc, r) => ({
      rec: acc.rec! + r.stats.rec!,
      recYds: acc.recYds! + r.stats.recYds!,
      recTd: acc.recTd! + r.stats.recTd!,
      recTargets: acc.recTargets! + r.stats.recTargets!,
      recLong: Math.max(acc.recLong!, r.stats.recLong!),
    }),
    { rec: 0, recYds: 0, recTd: 0, recTargets: 0, recLong: 0 },
  ),
  games100: RECEIVERS_2025.reduce((n, r) => n + r.games100, 0),
  games5rec: RECEIVERS_2025.reduce((n, r) => n + r.games5rec, 0),
};

/** Twenty seasons of game logs' worth of rows: enough to switch the table to virtual rows. */
type LogRow = { id: string; week: number; player: string; yards: number; touchdowns: number };
const LONG_ROWS: LogRow[] = Array.from({ length: 400 }, (_, i) => ({
  id: `log-${i + 1}`,
  week: (i % 18) + 1,
  player: `Row ${i + 1}`,
  yards: (i * 37) % 180,
  touchdowns: i % 4,
}));
const LONG_COLUMNS: DataColumn<LogRow>[] = [
  { id: "player", header: "Row", value: (r) => r.player, searchable: true, minWidth: 120 },
  { id: "week", header: "Wk", title: "Week", align: "right", value: (r) => r.week },
  { id: "yards", header: "YDS", title: "Yards", align: "right", value: (r) => r.yards },
  { id: "touchdowns", header: "TD", title: "Touchdowns", align: "right", value: (r) => r.touchdowns },
];

/** DataTable specimens: the full table with phone mode, plus loading and empty states. */
export const TABLE_SPECIMENS: Specimen[] = [
  {
    id: "datatable",
    name: "DataTable",
    note: "Phone mode keeps REC / YDS / TD in the table; tap a row for every other column. Sort & columns lives in a sheet. Choices are remembered per table.",
    render: () => (
      <DataTable
        id="gallery-receivers"
        data={RECEIVERS_2025}
        columns={RECEIVER_COLUMNS}
        getRowId={(r) => r.id}
        identityColumn="player"
        primaryColumns={["rec", "recYds", "recTd"]}
        totals={RECEIVER_TOTALS}
        initialSort={{ id: "recYds", desc: true }}
        searchable
        searchPlaceholder="Search receivers"
        caption="2025 receiving"
      />
    ),
  },
  {
    id: "datatable-long",
    name: "DataTable · long",
    note: "Past 120 rows only the rows in view are rendered, so a season of league-wide stats scrolls smoothly on a phone.",
    render: () => (
      <DataTable
        id="gallery-long"
        data={LONG_ROWS}
        columns={LONG_COLUMNS}
        getRowId={(r) => r.id}
        identityColumn="player"
        primaryColumns={["yards", "touchdowns"]}
        searchable
        searchPlaceholder="Search rows"
        caption="Four hundred rows"
      />
    ),
  },
  {
    id: "datatable-states",
    name: "DataTable states",
    render: () => (
      <div className="space-y-4">
        <DataTable
          id="gallery-loading"
          data={undefined}
          columns={RECEIVER_COLUMNS}
          getRowId={(r) => r.id}
          identityColumn="player"
          primaryColumns={["rec", "recYds"]}
          loadingRows={3}
        />
        <DataTable
          id="gallery-empty"
          data={[]}
          columns={RECEIVER_COLUMNS}
          getRowId={(r) => r.id}
          identityColumn="player"
          primaryColumns={["rec", "recYds"]}
          emptyState={
            <EmptyState
              icon={Inbox}
              title="No box scores yet"
              description="Import a screenshot to fill this table."
            />
          }
        />
      </div>
    ),
  },
];
