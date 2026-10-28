import { useMutation } from "convex/react";
import { ArrowRightLeft, ChevronDown, Pencil } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useFranchise } from "@/app/franchise";
import { useMoveActions } from "@/app/moves/useMoveActions";
import { useSeason } from "@/app/season";
import { MovePlayerSheet } from "@/components/player/MovePlayerSheet";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/button";
import type { SelectOption } from "@/components/ui/select";
import { EditPlayerSheet } from "./EditPlayerSheet";
import type { PlayerPage } from "./types";

/**
 * Edit (the player's own facts) and Move for the player page's hero. Move is a menu: onto a team
 * or status for a season without a transaction, or a trade, signing, other move or injury
 * recorded on Transactions. Each sheet remounts on open so it starts from the latest data.
 */
export function PlayerEditActions({ page, teams }: { page: PlayerPage; teams: readonly SelectOption[] }) {
  const move = useMutation(api.players.move.move);
  const { seasons, season } = useSeason();
  const userTeamId = useFranchise()?.userTeam._id;
  const moveActions = useMoveActions();
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [opened, setOpened] = useState(0);
  const latest = page.history.at(-1);
  const anchorYear = latest?.year ?? season?.year ?? page.startYear;
  // His stint in the season on screen (the last one when he moved), else his latest team.
  const here = page.history.filter((h) => h.year === season?.year).at(-1);
  const teamId = here?.entry.teamId ?? latest?.entry.teamId ?? userTeamId;
  const open = (which: "edit" | "move") => {
    setOpened((n) => n + 1);
    (which === "edit" ? setEditOpen : setMoveOpen)(true);
  };
  const items: ActionMenuItem[] = [
    ...(season && teamId
      ? [{ id: "move", label: "Move team or status", icon: ArrowRightLeft, onSelect: () => open("move") }]
      : []),
    ...moveActions({
      playerId: page.player._id,
      name: page.player.displayName,
      position: page.player.position,
      teamId: here?.entry.teamId ?? latest?.entry.teamId,
    }),
  ];

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => open("edit")}>
        <Pencil /> Edit
      </Button>
      {items.length > 0 && (
        <ActionMenu
          label={`Move ${page.player.displayName}`}
          items={items}
          trigger={
            <Button size="sm" variant="outline">
              <ArrowRightLeft /> Move <ChevronDown />
            </Button>
          }
        />
      )}
      <EditPlayerSheet
        key={`edit-${opened}`}
        page={page}
        teams={teams}
        anchorYear={anchorYear}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      {season && teamId && (
        <MovePlayerSheet
          key={`move-${opened}`}
          open={moveOpen}
          onOpenChange={setMoveOpen}
          name={page.player.displayName}
          seasons={seasons.map((s) => ({ value: s._id, label: String(s.year) }))}
          teams={teams}
          initial={{ seasonId: season._id, teamId, status: here?.entry.status ?? "active" }}
          onMove={(values) =>
            move({
              playerId: page.player._id,
              seasonId: values.seasonId as Id<"seasons">,
              teamId: values.teamId as Id<"teams">,
              status: values.status,
              statusWeekKey: values.statusWeekKey,
              leaving: values.leaving,
            })
          }
        />
      )}
    </>
  );
}
