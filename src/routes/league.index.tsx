import { createFileRoute } from "@tanstack/react-router";
import { LeagueScreen } from "@/features/league/LeagueScreen";

export const Route = createFileRoute("/league/")({ component: LeagueScreen });
