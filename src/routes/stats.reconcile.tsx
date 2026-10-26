import { createFileRoute } from "@tanstack/react-router";
import { ReconcileScreen } from "@/features/stats/ReconcileScreen";

export const Route = createFileRoute("/stats/reconcile")({ component: ReconcileScreen });
