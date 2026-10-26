import { createFileRoute } from "@tanstack/react-router";
import { HistoryScreen } from "@/features/history/HistoryScreen";

export const Route = createFileRoute("/history/")({ component: HistoryScreen });
