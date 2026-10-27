import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ArrowRightLeft } from "lucide-react";
import type { api } from "@convex/_generated/api";
import { positionColor, type PositionColor } from "@shared/domain";
import { ageInSeason, positionOrder } from "@shared/players/format";
import type { DataColumn } from "@/components/data/DataTable";
import { PlayerChip } from "@/components/player/PlayerChip";
import { rosterEntryColumns } from "@/components/player/rosterEntryColumns";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type RosterData = FunctionReturnType<typeof api.players.roster.bySeason>;
export type RosterRow = RosterData["entries"][number];

/** Literal classes so Tailwind sees every one; a thin bar in the position's color leads each row. */
const accent: Record<PositionColor, string> = {
  qb: "bg-pos-qb",
  hb: "bg-pos-hb",
  fb: "bg-pos-fb",
  wr: "bg-pos-wr",
  te: "bg-pos-te",
  ol: "bg-pos-ol",
  edge: "bg-pos-edge",
  dt: "bg-pos-dt",
  lb: "bg-pos-lb",
  cb: "bg-pos-cb",
  s: "bg-pos-s",
  k: "bg-pos-k",
  p: "bg-pos-p",
  ls: "bg-pos-ls",
};

export const rosterAge = (row: RosterRow, year: number) => row.entry.age ?? ageInSeason(row.player, year);

function playerColumn(team: TeamLike): DataColumn<RosterRow> {
  return {
    id: "player",
    header: "Player",
    value: (r) => r.player.displayName,
    searchable: true,
    minWidth: 200,
    edit: { kind: "text", get: (r) => r.player.displayName },
    cell: (r) => (
      <Link
        to="/players/$playerId"
        params={{ playerId: r.player._id }}
        className="flex items-center gap-2 rounded-md hover:text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          aria-hidden
          className={cn("h-7 w-0.5 shrink-0 rounded-full", accent[positionColor(r.entry.position)])}
        />
        <PlayerChip
          size="sm"
          showPosition={false}
          caption={
            r.injury ? (
              <span className="text-loss">
                {r.injury.onIr ? "IR · " : ""}
                {[r.injury.injuryType, r.injury.lengthLabel].filter(Boolean).join(" · ")}
              </span>
            ) : undefined
          }
          player={{
            displayName: r.player.displayName,
            position: r.entry.position,
            jersey: r.entry.jersey,
            headshotUrl: r.headshotUrl,
            team,
          }}
        />
      </Link>
    ),
  };
}

/**
 * Roster table columns. The identity column links to the player page; in edit mode every column
 * but the action edits inline (the name and college on the player, the rest on this season's entry).
 */
export function rosterColumns(
  team: TeamLike,
  year: number,
  onMove: (row: RosterRow) => void,
): DataColumn<RosterRow>[] {
  const c = rosterEntryColumns<RosterRow>(
    (r) => r.entry,
    (r) => rosterAge(r, year),
  );
  return [
    playerColumn(team),
    c.position,
    c.jersey,
    c.age,
    c.ovr,
    c.devTrait,
    c.exp,
    c.status,
    c.statusWeekKey,
    c.acquisitionType,
    c.acquisitionYear,
    c.acquisitionDetail,
    c.contractYears,
    c.contractApy,
    c.contractExpiresYear,
    {
      id: "college",
      header: "College",
      value: (r) => r.player.college,
      edit: { kind: "text", get: (r) => r.player.college },
    },
    c.gradeNote,
    {
      id: "move",
      header: "Move",
      title: "Move to another team or status",
      sortable: false,
      value: () => null,
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Move ${r.player.displayName}`}
          onClick={(e) => {
            e.stopPropagation();
            onMove(r);
          }}
        >
          <ArrowRightLeft /> Move…
        </Button>
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
