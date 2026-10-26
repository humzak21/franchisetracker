import { createFileRoute } from "@tanstack/react-router";
import { DraftScreen } from "@/features/draft/DraftScreen";

export const Route = createFileRoute("/draft")({ component: DraftScreen });
