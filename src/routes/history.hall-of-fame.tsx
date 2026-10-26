import { createFileRoute } from "@tanstack/react-router";
import { HallOfFameScreen } from "@/features/history/hof/HallOfFameScreen";

export const Route = createFileRoute("/history/hall-of-fame")({ component: HallOfFameScreen });
