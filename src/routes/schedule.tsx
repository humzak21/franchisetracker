import { createFileRoute } from "@tanstack/react-router";
import { ScheduleScreen } from "@/features/schedule/ScheduleScreen";

export const Route = createFileRoute("/schedule")({ component: ScheduleScreen });
