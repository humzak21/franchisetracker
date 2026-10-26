import { createFileRoute } from "@tanstack/react-router";
import { PlannedScreen } from "@/app/shell/PlannedScreen";

export const Route = createFileRoute("/history")({ component: () => <PlannedScreen nav="history" /> });
