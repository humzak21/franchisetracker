import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Ellipsis } from "lucide-react";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { positionColor, type PositionColor, type PositionGroup } from "@shared/domain";
import { ageInSeason, positionOrder } from "@shared/players/format";
import { acquisitionLabel } from "@shared/roster/acquisition";
import type { DataColumn } from "@/components/data/DataTable";
import { PlayerChip } from "@/components/player/PlayerChip";
import { rosterEntryColumns } from "@/components/player/rosterEntryColumns";
import type { TeamLike } from "@/components/team/TeamLogo";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { SelectBox } from "@/components/ui/SelectBox";
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

/** A position group's section anchor, for the roster's jump links. */
export const positionAnchor = (group: PositionGroup) => `pos-${group.toLowerCase()}`;

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

/** Which players are picked for a batch move, and how to pick one. */
export type RosterPick = { has: (id: Id<"players">) => boolean; toggle: (id: Id<"players">) => void };

/**
 * Roster table columns. The identity column links to the player page; in edit mode every column
 * but the actions edits inline (the name and college on the player, the rest on this season's entry).
 * Acquired reads as the draft slot for players the user team drafted. The last column picks the
 * player for a batch move.
 */
export function rosterColumns(
  team: TeamLike,
  year: number,
  userTeamId: Id<"teams"> | undefined,
  actionsFor: (row: RosterRow) => ActionMenuItem[],
  pick: RosterPick,
): DataColumn<RosterRow>[] {
  const c = rosterEntryColumns<RosterRow>(
    (r) => r.entry,
    (r) => rosterAge(r, year),
  );
  const acquired = (r: RosterRow) =>
    userTeamId ? acquisitionLabel(r.entry.acquisition, r.player.draft, userTeamId) : null;
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
    {
      ...c.acquisitionType,
      value: acquired,
      cell: (r) => acquired(r) ?? <span className="text-subtle-foreground">—</span>,
    },
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
      id: "actions",
      header: "Actions",
      title: "Move him, or record a transaction or injury",
      sortable: false,
      value: () => null,
      cell: (r) => (
        <ActionMenu
          label={`Actions for ${r.player.displayName}`}
          items={actionsFor(r)}
          trigger={
            <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${r.player.displayName}`}>
              <Ellipsis />
            </Button>
          }
        />
      ),
    },
    {
      id: "select",
      header: "Pick",
      title: "Pick for a batch move",
      sortable: false,
      value: () => null,
      cell: (r) => (
        <SelectBox
          checked={pick.has(r.player._id)}
          onChange={() => pick.toggle(r.player._id)}
          label={`Pick ${r.player.displayName}`}
        />
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
