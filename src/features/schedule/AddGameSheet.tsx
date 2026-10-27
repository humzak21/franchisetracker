import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WeekKey } from "@shared/domain";
import { useFranchise } from "@/app/franchise";
import { GameForm } from "@/components/forms/GameForm";
import { emptyGameForm, firstOpenWeek } from "@/components/forms/gameFormValue";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

type AddGameSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: Id<"seasons">;
  year: number;
  /** Weeks that already have a game; the form starts on the next open one. */
  takenWeeks: readonly WeekKey[];
};

/** A game entered by hand for the season shown, the franchise's team as one side. */
export function AddGameSheet({ open, onOpenChange, seasonId, year, takenWeeks }: AddGameSheetProps) {
  const active = useFranchise();
  const teams = useQuery(api.league.teams.list, open ? {} : "skip");
  const create = useMutation(api.games.manage.create);
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add game"
      description={`${year}${active ? ` · ${active.userTeam.city} ${active.userTeam.name}` : ""}. Leave the score blank for a game not played yet.`}
    >
      {open && active && teams ? (
        <GameForm
          teams={teams}
          userTeamId={active.userTeam._id}
          initial={emptyGameForm(firstOpenWeek(takenWeeks))}
          withNotes
          submitLabel="Add game"
          onSubmit={async ({ opponentTeamId, ...input }) => {
            await create({ seasonId, ...input, opponentTeamId: opponentTeamId as Id<"teams"> | undefined });
            onOpenChange(false);
          }}
        />
      ) : (
        <Skeleton className="h-80 rounded-xl" />
      )}
    </BottomSheet>
  );
}
