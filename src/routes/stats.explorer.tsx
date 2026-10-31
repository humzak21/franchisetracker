import { createFileRoute } from "@tanstack/react-router";
import { parseQuestion, questionSearch, type ExplorerSearch } from "@shared/stats";
import { ExplorerScreen } from "@/features/stats/ExplorerScreen";

export const Route = createFileRoute("/stats/explorer")({
  validateSearch: (search: Record<string, unknown>): ExplorerSearch => questionSearch(parseQuestion(search)),
  component: function ExplorerRoute() {
    const search = Route.useSearch();
    return <ExplorerScreen search={search} />;
  },
});
