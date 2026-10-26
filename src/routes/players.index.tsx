import { createFileRoute } from "@tanstack/react-router";
import { PlayersScreen } from "@/features/players/PlayersScreen";

export const Route = createFileRoute("/players/")({ component: PlayersScreen });
