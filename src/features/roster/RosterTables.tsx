import { ArrowLeftRight, ArrowRightLeft, UserMinus } from "lucide-react";
import { useMemo, useState } from "react";
import { POSITION_GROUPS, positionGroupOf } from "@shared/domain";
import { useFranchise } from "@/app/franchise";
import { useMoves } from "@/app/moves/MovesProvider";
import { useMoveActions } from "@/app/moves/useMoveActions";
import { SelectionBar } from "@/components/data/SelectionBar";
import { JumpLinks } from "@/components/layout/JumpLinks";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { useSelection } from "@/lib/hooks/useSelection";
import { PositionTable } from "./PositionTable";
import { RosterMoveSheet } from "./RosterMoveSheet";
import { positionAnchor, rosterColumns, type RosterRow } from "./rosterColumns";
import { useRosterEdit } from "./useRosterEdit";

/**
 * Every position group in its own table, one after another with jump links, each editable inline.
 * Picked rows go into one trade or one release each; a row's menu moves that player.
 */
export function RosterTables({
  rows,
  team,
  year,
  preFranchise,
}: {
  rows: readonly RosterRow[];
  team: TeamLike;
  year: number;
  preFranchise: boolean;
}) {
  const [moving, setMoving] = useState<RosterRow | null>(null);
  const onEdit = useRosterEdit();
  const userTeamId = useFranchise()?.franchise.userTeamId;
  const moveActions = useMoveActions();
  const moves = useMoves();
  const groups = useMemo(
    () =>
      POSITION_GROUPS.map((group) => ({
        group,
        rows: rows.filter((r) => positionGroupOf(r.entry.position) === group),
      })).filter((g) => g.rows.length > 0),
    [rows],
  );
  const ids = useMemo(() => rows.map((r) => r.player._id), [rows]);
  const selection = useSelection(ids);
  const { has, toggle } = selection;
  // The sheet takes the picks over; the roster starts clean for the next batch.
  const batch = (kind: "trade" | "other") => {
    selection.clear();
    moves.open({
      kind,
      prefill: {
        players: rows
          .filter((r) => has(r.player._id))
          .map((r) => ({
            person: {
              kind: "existing",
              playerId: r.player._id,
              name: r.player.displayName,
              position: r.entry.position,
            },
            teamId: r.entry.teamId,
          })),
      },
    });
  };
  const columns = useMemo(
    () =>
      rosterColumns(
        team,
        year,
        userTeamId,
        (r) => [
          {
            id: "move",
            label: "Move team or status",
            icon: ArrowRightLeft,
            onSelect: () => setMoving(r),
          },
          ...moveActions({
            playerId: r.player._id,
            name: r.player.displayName,
            position: r.entry.position,
            teamId: r.entry.teamId,
          }),
        ],
        { has, toggle },
      ),
    [team, year, userTeamId, moveActions, has, toggle],
  );
  const batchBar = moves.ready && !preFranchise && (
    <SelectionBar
      count={selection.picked.length}
      total={rows.length}
      state={selection.state}
      onToggleAll={selection.toggleAll}
      onClear={selection.clear}
    >
      <Button size="sm" variant="outline" onClick={() => batch("trade")}>
        <ArrowLeftRight /> Trade
      </Button>
      <Button size="sm" variant="destructive" onClick={() => batch("other")}>
        <UserMinus /> Release
      </Button>
    </SelectionBar>
  );

  return (
    <>
      {/* Picks move the batch bar into the jump links' sticky band, in reach down a long roster. */}
      {selection.picked.length === 0 && batchBar}
      <div className="sticky top-14 z-20 -mx-4 space-y-2 bg-background/90 backdrop-blur @tablet:top-16 @tablet:-mx-6">
        <JumpLinks
          className="static mx-0 border-b-0 @tablet:mx-0"
          links={groups.map(({ group, rows: inGroup }) => ({
            id: positionAnchor(group),
            label: `${group} ${inGroup.length}`,
          }))}
        />
        {selection.picked.length > 0 && batchBar && (
          <div className="border-b border-border px-4 pb-2 @tablet:px-6">{batchBar}</div>
        )}
      </div>
      {groups.map(({ group, rows: inGroup }) => (
        <PositionTable
          key={group}
          group={group}
          year={year}
          rows={inGroup}
          columns={columns}
          onEdit={onEdit}
        />
      ))}
      <RosterMoveSheet row={moving} onClose={() => setMoving(null)} />
    </>
  );
}
