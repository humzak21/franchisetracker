import { createFileRoute } from "@tanstack/react-router";
import { NewFranchiseScreen } from "@/app/setup/NewFranchiseScreen";

export const Route = createFileRoute("/franchises/new")({ component: NewFranchiseScreen });
