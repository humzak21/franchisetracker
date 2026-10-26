import { createFileRoute } from "@tanstack/react-router";
import { NotFoundScreen } from "@/app/shell/StatusScreens";
import { SeasonReportScreen } from "@/features/history/reports/SeasonReportScreen";

export const Route = createFileRoute("/history/reports/$year")({
  component: function SeasonReportRoute() {
    const { year } = Route.useParams();
    return <SeasonReportScreen key={year} year={Number(year)} />;
  },
  errorComponent: NotFoundScreen,
});
