import { createFileRoute } from "@tanstack/react-router";
import { WeeklyAwardsBatchScreen } from "@/features/ingestion/weekly/WeeklyAwardsBatchScreen";

export const Route = createFileRoute("/inbox/weekly-awards")({ component: WeeklyAwardsBatchScreen });
