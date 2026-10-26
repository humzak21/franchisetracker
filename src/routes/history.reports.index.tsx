import { createFileRoute } from "@tanstack/react-router";
import { ReportsScreen } from "@/features/history/reports/ReportsScreen";

export const Route = createFileRoute("/history/reports/")({ component: ReportsScreen });
