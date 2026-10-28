import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { useShortcut } from "@/app/keyboard";
import { Button } from "@/components/ui/button";
import { useSwipe } from "@/lib/hooks/useSwipe";

type Neighbours = { previousGameId: Id<"games"> | null; nextGameId: Id<"games"> | null } | undefined;

/** Previous and next game: buttons, `[` and `]`, and swiping the game area. */
export function GameNav({
  data,
  swipeArea,
}: {
  data: Neighbours;
  swipeArea: RefObject<HTMLDivElement | null>;
}) {
  const navigate = useNavigate();
  // Replace, not push: stepping through games shouldn't stack up, so Back leaves the game screen.
  const go = (id: Id<"games"> | null | undefined) =>
    id && void navigate({ to: "/games/$gameId", params: { gameId: id }, replace: true });
  useShortcut("game-prev", {
    key: "[",
    label: "Previous game",
    touch: "Swipe right",
    handler: () => go(data?.previousGameId),
  });
  useShortcut("game-next", {
    key: "]",
    label: "Next game",
    touch: "Swipe left",
    handler: () => go(data?.nextGameId),
  });
  useSwipe(swipeArea, {
    onSwipeLeft: () => go(data?.nextGameId),
    onSwipeRight: () => go(data?.previousGameId),
  });
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!data?.previousGameId}
        onClick={() => go(data?.previousGameId)}
        aria-label="Previous game"
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!data?.nextGameId}
        onClick={() => go(data?.nextGameId)}
        aria-label="Next game"
      >
        <ChevronRight />
      </Button>
    </>
  );
}
