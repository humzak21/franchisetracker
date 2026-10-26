import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "@convex/_generated/dataModel";
import { NotFoundScreen } from "@/app/shell/StatusScreens";
import { PlayerScreen } from "@/features/player/PlayerScreen";

export const Route = createFileRoute("/players/$playerId")({
  component: function PlayerRoute() {
    const { playerId } = Route.useParams();
    return <PlayerScreen key={playerId} playerId={playerId as Id<"players">} />;
  },
  // A malformed or deleted id fails the query; show the same page as an unknown route.
  errorComponent: NotFoundScreen,
});
