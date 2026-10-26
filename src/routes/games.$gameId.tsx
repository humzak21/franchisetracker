import { createFileRoute } from "@tanstack/react-router";
import { GameDetailScreen } from "@/features/game/GameDetailScreen";

export const Route = createFileRoute("/games/$gameId")({
  component: function GameRoute() {
    const { gameId } = Route.useParams();
    return <GameDetailScreen gameId={gameId} />;
  },
});
