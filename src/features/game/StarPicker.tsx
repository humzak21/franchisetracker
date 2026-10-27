import { useMutation } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MAX_STARS } from "@shared/games/stars";
import type { StarView } from "@/components/player/GameStars";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import { PickedStars } from "./PickedStars";
import { StarCandidates } from "./StarCandidates";
import { draftFromStars, starsInput, type DraftStar } from "./starDraft";

type Side = TeamLike & { _id: Id<"teams"> };

type StarPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: Id<"games">;
  stars: readonly StarView[];
  user: Side;
  opponent: Side | null;
};

/** Pick the game's stars: any number, in order, each with an optional caption. */
export function StarPicker({ open, onOpenChange, ...props }: StarPickerProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Stars of the game"
      description="Pick as many as you like, in order. Players link to their pages; anyone else can be typed in."
    >
      {open && <PickerBody {...props} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  );
}

function PickerBody({
  gameId,
  stars,
  user,
  opponent,
  onDone,
}: Omit<StarPickerProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const candidates = useQuery(api.games.stars.candidates, { gameId });
  const save = useMutation(api.games.stars.setStars);
  const [draft, setDraft] = useState<DraftStar[]>(() => draftFromStars(stars));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sideOf = (star: DraftStar) =>
    star.teamId === user._id ? user.abbr : opponent && star.teamId === opponent._id ? opponent.abbr : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await save({ gameId, stars: starsInput(draft) });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not save the stars."));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-2">
      <PickedStars stars={draft} onChange={setDraft} sideOf={sideOf} />
      {draft.length < MAX_STARS && (
        <StarCandidates
          candidates={candidates}
          picked={draft}
          user={user}
          opponent={opponent}
          onAdd={(star) =>
            setDraft((current) => [
              ...current,
              { ...star, caption: "", key: star.playerId ?? `typed-${Date.now()}-${star.name}` },
            ])
          }
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => void submit()}>
          {busy && <LoaderCircle className="animate-spin" />}
          Save stars
        </Button>
      </div>
    </div>
  );
}
