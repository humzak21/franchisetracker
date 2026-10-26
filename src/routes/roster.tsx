import { createFileRoute } from "@tanstack/react-router";
import { RosterScreen } from "@/features/roster/RosterScreen";

export const Route = createFileRoute("/roster")({ component: RosterScreen });
