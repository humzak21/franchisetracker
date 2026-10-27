import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GameForm } from "@/components/forms/GameForm";
import type { GameFormValue } from "@/components/forms/gameFormValue";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";

type GameDetail = NonNullable<FunctionReturnType<typeof api.games.schedule.get>>;

function formFromGame({ game, header }: GameDetail): GameFormValue {
  return {
    weekKey: game.weekKey,
    bye: game.status === "bye",
    opponentTeamId: game.opponent?._id ?? "",
    userIsHome: game.userIsHome ?? true,
    neutralSite: header.neutralSite,
    us: game.us === null ? "" : String(game.us),
    them: game.them === null ? "" : String(game.them),
    overtime: game.overtime,
    dateLabel: game.dateLabel ?? "",
    stadium: header.stadium ?? "",
    weather: header.weather ?? "",
    notes: "",
  };
}

/** Edits the game's header (week, opponent, side, score, date, stadium, weather) or deletes the game. */
export function EditGameSheet({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: GameDetail;
}) {
  const teams = useQuery(api.league.teams.list, open ? {} : "skip");
  const update = useMutation(api.games.manage.update);
  const remove = useMutation(api.games.manage.remove);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gameId = data.game._id;

  const confirmDelete = async () => {
    setError(null);
    try {
      await remove({ gameId });
      setConfirming(false);
      onOpenChange(false);
      void navigate({ to: "/schedule" });
    } catch (err) {
      setError(errorMessage(err, "Could not delete the game."));
    }
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Edit game"
        description="Season record, standings and stats update when you save."
      >
        {open && teams ? (
          <GameForm
            teams={teams}
            userTeamId={data.userTeam._id}
            initial={formFromGame(data)}
            submitLabel="Save game"
            onSubmit={async ({ opponentTeamId, notes: _notes, ...input }) => {
              await update({ gameId, ...input, opponentTeamId: opponentTeamId as Id<"teams"> | undefined });
              onOpenChange(false);
            }}
            secondary={
              <Button variant="ghost" className="mr-auto text-loss" onClick={() => setConfirming(true)}>
                <Trash2 /> Delete game
              </Button>
            }
          />
        ) : (
          <Skeleton className="h-80 rounded-xl" />
        )}
      </BottomSheet>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title="Delete this game?"
          description="Its box score, team stats, stars, notes and milestones go too; season stats and records are recalculated. Screenshots stay in the inbox."
        >
          <div className="space-y-3 p-5">
            {error && (
              <p role="alert" className="text-sm text-loss">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={() => void confirmDelete()}>
                Delete game
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
