import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { ageInSeason, formatAcquisition, positionOrder } from "@shared/players/format";
import type { DataColumn } from "@/components/data/DataTable";
import { PlayerChip } from "@/components/player/PlayerChip";
import { PositionBadge } from "@/components/player/PositionBadge";
import type { TeamLike } from "@/components/team/TeamLogo";

export type RosterData = FunctionReturnType<typeof api.players.roster.bySeason>;
export type RosterRow = RosterData["entries"][number];

const age = (row: RosterRow, year: number) => row.entry.age ?? ageInSeason(row.player, year);

/** Roster table columns. The identity column links to the player page. */
export function rosterColumns(team: TeamLike, year: number): DataColumn<RosterRow>[] {
  return [
    {
      id: "player",
      header: "Player",
      value: (r) => r.player.displayName,
      searchable: true,
      minWidth: 200,
      cell: (r) => (
        <Link
          to="/players/$playerId"
          params={{ playerId: r.player._id }}
          className="block rounded-md hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <PlayerChip
            size="sm"
            showPosition={false}
            player={{
              displayName: r.player.displayName,
              position: r.entry.position,
              jersey: r.entry.jersey,
              headshotUrl: null,
              team,
            }}
          />
        </Link>
      ),
    },
    {
      id: "pos",
      header: "Pos",
      title: "Position",
      value: (r) => positionOrder(r.entry.position),
      cell: (r) => <PositionBadge position={r.entry.position} />,
    },
    { id: "jersey", header: "#", title: "Jersey", align: "right", value: (r) => r.entry.jersey },
    { id: "age", header: "Age", align: "right", value: (r) => age(r, year) },
    {
      id: "ovr",
      header: "OVR",
      title: "Overall rating",
      align: "right",
      sortDescFirst: true,
      value: (r) => r.entry.ovr,
      cell: (r) => <span className="num font-semibold">{r.entry.ovr ?? "—"}</span>,
    },
    { id: "exp", header: "Exp", title: "Years of experience", align: "right", value: (r) => r.entry.exp },
    { id: "college", header: "College", value: (r) => r.player.college },
    {
      id: "acquisition",
      header: "Acquired",
      title: "Acquisition",
      value: (r) => formatAcquisition(r.entry.acquisition),
    },
    {
      id: "grade",
      header: "Grade note",
      sortable: false,
      value: (r) => r.entry.gradeNote,
      cell: (r) =>
        r.entry.gradeNote ? (
          <span className="block max-w-80 truncate text-muted-foreground" title={r.entry.gradeNote}>
            {r.entry.gradeNote}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
  ];
}

/** Position order, then highest OVR first: the default depth-chart reading order. */
export function byDepthOrder(a: RosterRow, b: RosterRow): number {
  return (
    positionOrder(a.entry.position) - positionOrder(b.entry.position) ||
    (b.entry.ovr ?? 0) - (a.entry.ovr ?? 0)
  );
}
