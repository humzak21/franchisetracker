import { createFileRoute } from "@tanstack/react-router";
import { TimelineScreen } from "@/features/history/timeline/TimelineScreen";

export const Route = createFileRoute("/history/timeline")({ component: TimelineScreen });
