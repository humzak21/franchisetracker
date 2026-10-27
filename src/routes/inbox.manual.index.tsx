import { createFileRoute } from "@tanstack/react-router";
import { ManualStartScreen } from "@/features/ingestion/manual/ManualStartScreen";
import { parseManualSearch } from "@/features/ingestion/manual/search";

export const Route = createFileRoute("/inbox/manual/")({
  validateSearch: parseManualSearch,
  component: function ManualStartRoute() {
    const search = Route.useSearch();
    return <ManualStartScreen search={search} />;
  },
});
