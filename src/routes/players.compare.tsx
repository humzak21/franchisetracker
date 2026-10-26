import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "@convex/_generated/dataModel";
import { CompareScreen } from "@/features/players/CompareScreen";

export const Route = createFileRoute("/players/compare")({
  validateSearch: (search: Record<string, unknown>): { ids: Id<"players">[] } => ({
    ids: Array.isArray(search.ids)
      ? search.ids.filter((id): id is Id<"players"> => typeof id === "string").slice(0, 4)
      : [],
  }),
  component: function CompareRoute() {
    const { ids } = Route.useSearch();
    return <CompareScreen ids={ids} />;
  },
});
