import { Pencil } from "lucide-react";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Section } from "@/components/layout/Section";
import { GameStars, type StarView } from "@/components/player/GameStars";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { StarPicker } from "./StarPicker";

type Side = TeamLike & { _id: Id<"teams"> };

/** The game's stars, with an Edit control that opens the picker. */
export function StarsSection({
  gameId,
  stars,
  user,
  opponent,
}: {
  gameId: Id<"games">;
  stars: StarView[];
  user: Side;
  opponent: Side | null;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <Section
      title="Stars of the game"
      actions={
        <Button size="sm" variant="outline" onClick={() => setPicking(true)} aria-label="Edit stars">
          <Pencil /> Edit
        </Button>
      }
    >
      <GameStars stars={stars} team={user} opponent={opponent} />
      <StarPicker
        open={picking}
        onOpenChange={setPicking}
        gameId={gameId}
        stars={stars}
        user={user}
        opponent={opponent}
      />
    </Section>
  );
}
