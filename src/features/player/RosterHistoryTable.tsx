import { useMemo } from "react";
import { ageInSeason, formatAcquisition } from "@shared/players/format";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { PositionBadge } from "@/components/player/PositionBadge";
import { TeamChip } from "@/components/team/TeamChip";
import type { HistoryRow, PlayerPage } from "./types";

function historyColumns(player: PlayerPage["player"]): DataColumn<HistoryRow>[] {
  return [
    {
      id: "season",
      header: "Season",
      value: (r) => r.year,
      cell: (r) => <span className="num font-medium">{r.year}</span>,
    },
    {
      id: "team",
      header: "Team",
      value: (r) => r.team.abbr,
      cell: (r) => <TeamChip team={r.team} label="abbr" size="xs" />,
    },
    { id: "jersey", header: "#", align: "right", value: (r) => r.entry.jersey },
    {
      id: "pos",
      header: "Pos",
      value: (r) => r.entry.position,
      cell: (r) => <PositionBadge position={r.entry.position} />,
    },
    {
      id: "ovr",
      header: "OVR",
      title: "Overall rating",
      align: "right",
      sortDescFirst: true,
      value: (r) => r.entry.ovr,
      cell: (r) => <span className="num font-semibold">{r.entry.ovr ?? "—"}</span>,
    },
    { id: "age", header: "Age", align: "right", value: (r) => r.entry.age ?? ageInSeason(player, r.year) },
    { id: "acquisition", header: "Acquired", value: (r) => formatAcquisition(r.entry.acquisition) },
    {
      id: "grade",
      header: "Grade note",
      sortable: false,
      value: (r) => r.entry.gradeNote,
      cell: (r) =>
        r.entry.gradeNote ? (
          <span className="block max-w-96 truncate text-muted-foreground" title={r.entry.gradeNote}>
            {r.entry.gradeNote}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
  ];
}

/** Every season the player was on a roster in this franchise, oldest first. */
export function RosterHistoryTable({ page }: { page: PlayerPage }) {
  const columns = useMemo(() => historyColumns(page.player), [page.player]);
  return (
    <DataTable
      id="player-roster-history"
      data={page.history}
      columns={columns}
      getRowId={(r) => r.entry._id}
      identityColumn="season"
      primaryColumns={["team", "ovr", "age"]}
      caption="Roster history"
    />
  );
}
