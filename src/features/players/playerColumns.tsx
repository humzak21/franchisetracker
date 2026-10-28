import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Check, Ellipsis } from "lucide-react";
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
import { cn } from "@/lib/cn";

export type DirectoryRow = FunctionReturnType<typeof api.players.directory.byTeam>["rows"][number];

type Selection = { selected: ReadonlySet<Id<"players">>; toggle: (id: Id<"players">) => void; full: boolean };

/**
 * Players index columns: a compare toggle, the player linking to their page, sortable facts, then
 * a menu to record a transaction or injury for him (none until the sheets can open).
 */
export function playerColumns(
  team: TeamLike,
  selection: Selection,
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
        const on = selection.selected.has(r.playerId);
        return (
          <span className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={`Compare ${r.displayName}`}
              disabled={!on && selection.full}
              onClick={(e) => {
                e.stopPropagation();
                selection.toggle(r.playerId);
              }}
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded border transition-colors disabled:opacity-30 pointer-coarse:size-7",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
              )}
            >
              {on && <Check className="size-3.5" />}
            </button>
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
