import { createFileRoute } from "@tanstack/react-router";
import { RosterScreen } from "@/features/roster/RosterScreen";
import { parseRosterSearch } from "@/features/roster/search";

export const Route = createFileRoute("/roster")({
  validateSearch: parseRosterSearch,
  component: function RosterRoute() {
    const search = Route.useSearch();
    return <RosterScreen search={search} />;
  },
});
