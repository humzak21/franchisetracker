import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Ellipsis } from "lucide-react";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { positionOrder } from "@shared/players/format";
import type { DataColumn } from "@/components/data/DataTable";
import { PlayerChip } from "@/components/player/PlayerChip";
import { PositionBadge } from "@/components/player/PositionBadge";
import type { TeamLike } from "@/components/team/TeamLogo";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { SelectBox } from "@/components/ui/SelectBox";

export type DirectoryRow = FunctionReturnType<typeof api.players.directory.byTeam>["rows"][number];

type Pick = { has: (id: Id<"players">) => boolean; toggle: (id: Id<"players">) => void };

/**
 * Players index columns: a box to pick him (to compare, or for a batch move), the player linking
 * to their page, sortable facts, then a menu to record a transaction or injury for him (none
 * until the sheets can open).
 */
export function playerColumns(
  team: TeamLike,
  pick: Pick,
  actionsFor: (row: DirectoryRow) => ActionMenuItem[],
): DataColumn<DirectoryRow>[] {
  return [
    {
      id: "player",
      header: "Player",
      value: (r) => r.displayName,
      searchable: true,
      minWidth: 220,
      cell: (r) => {
        return (
          <span className="flex min-w-0 items-center gap-2">
            <SelectBox
              checked={pick.has(r.playerId)}
              onChange={() => pick.toggle(r.playerId)}
              label={`Pick ${r.displayName}`}
            />
            <Link
              to="/players/$playerId"
              params={{ playerId: r.playerId }}
              className="block min-w-0 rounded-md hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayerChip
                size="sm"
                showPosition={false}
                player={{
                  displayName: r.displayName,
                  position: r.position,
                  jersey: r.jersey,
                  headshotUrl: r.headshotUrl,
                  team,
                }}
              />
            </Link>
          </span>
        );
      },
    },
    {
      id: "pos",
      header: "Pos",
      title: "Position",
      value: (r) => positionOrder(r.position),
      cell: (r) => <PositionBadge position={r.position} />,
    },
    {
      id: "ovr",
      header: "OVR",
      title: "Overall rating (latest)",
      align: "right",
      sortDescFirst: true,
      value: (r) => r.ovr,
      cell: (r) => <span className="num font-semibold">{r.ovr ?? "—"}</span>,
    },
    { id: "age", header: "Age", align: "right", value: (r) => r.age },
    {
      id: "seasons",
      header: "Yrs",
      title: "Seasons with the team in the franchise",
      align: "right",
      sortDescFirst: true,
      value: (r) => r.seasons,
    },
    {
      id: "latest",
      header: "Last",
      title: "Latest season with the team",
      align: "right",
      value: (r) => r.latestYear,
    },
    {
      id: "status",
      header: "Status",
      value: (r) => (r.retired ? "Retired" : r.isReal ? "Real" : "Fictional"),
      cell: (r) => (
        <span className="flex gap-1">
          {!r.isReal && <Badge>Fictional</Badge>}
          {r.retired && <Badge>Retired</Badge>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      title: "Record a transaction or injury",
      sortable: false,
      value: () => null,
      cell: (r) => {
        const items = actionsFor(r);
        return items.length === 0 ? null : (
          <ActionMenu
            label={`Actions for ${r.displayName}`}
            items={items}
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${r.displayName}`}>
                <Ellipsis />
              </Button>
            }
          />
        );
      },
    },
  ];
}
