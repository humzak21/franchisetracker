import { useMutation } from "convex/react";
import { ArrowRightLeft, Pencil } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { MovePlayerSheet } from "@/components/player/MovePlayerSheet";
import { Button } from "@/components/ui/button";
import type { SelectOption } from "@/components/ui/select";
import { EditPlayerSheet } from "./EditPlayerSheet";
import type { PlayerPage } from "./types";

/**
 * Edit (the player's own facts) and Move (onto a team or status for a season) for the player
 * page's hero. Each sheet remounts on open so it starts from the latest data.
 */
export function PlayerEditActions({ page, teams }: { page: PlayerPage; teams: readonly SelectOption[] }) {
  const move = useMutation(api.players.move.move);
  const { seasons, season } = useSeason();
  const userTeamId = useFranchise()?.userTeam._id;
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

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => open("edit")}>
        <Pencil /> Edit
      </Button>
      {season && teamId && (
        <Button size="sm" variant="outline" onClick={() => open("move")}>
          <ArrowRightLeft /> Move
        </Button>
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
