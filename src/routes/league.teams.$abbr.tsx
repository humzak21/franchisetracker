import { createFileRoute } from "@tanstack/react-router";
import { NotFoundScreen } from "@/app/shell/StatusScreens";
import { TeamHistoryScreen } from "@/features/league/TeamHistoryScreen";

export const Route = createFileRoute("/league/teams/$abbr")({
  component: function TeamHistoryRoute() {
    const { abbr } = Route.useParams();
    return <TeamHistoryScreen key={abbr} abbr={abbr.toUpperCase()} />;
  },
  errorComponent: NotFoundScreen,
});
