import { createFileRoute } from "@tanstack/react-router";
import { NotFoundScreen } from "@/app/shell/StatusScreens";
import { SeasonRecapScreen } from "@/features/history/recap/SeasonRecapScreen";

export const Route = createFileRoute("/history/recaps/$year")({
  component: function SeasonRecapRoute() {
    const { year } = Route.useParams();
    return <SeasonRecapScreen key={year} year={Number(year)} />;
  },
  errorComponent: NotFoundScreen,
});
