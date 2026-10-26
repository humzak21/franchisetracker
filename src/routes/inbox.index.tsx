import { createFileRoute } from "@tanstack/react-router";
import { InboxScreen } from "@/features/ingestion/inbox/InboxScreen";

export const Route = createFileRoute("/inbox/")({ component: InboxScreen });
