import { createFileRoute } from "@tanstack/react-router";
import { AwardsScreen } from "@/features/awards/AwardsScreen";

export const Route = createFileRoute("/awards")({ component: AwardsScreen });
