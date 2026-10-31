import { createFileRoute } from "@tanstack/react-router";
import { NotFoundScreen } from "@/app/shell/StatusScreens";
import { RivalryScreen } from "@/features/league/RivalryScreen";

export const Route = createFileRoute("/league/rivals/$abbr")({
  component: function RivalryRoute() {
    const { abbr } = Route.useParams();
    return <RivalryScreen key={abbr} abbr={abbr.toUpperCase()} />;
  },
  errorComponent: NotFoundScreen,
});
