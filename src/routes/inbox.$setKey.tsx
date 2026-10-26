import { createFileRoute } from "@tanstack/react-router";
import { ReviewScreen } from "@/features/ingestion/review/ReviewScreen";

export const Route = createFileRoute("/inbox/$setKey")({
  component: function ReviewRoute() {
    const { setKey } = Route.useParams();
    return <ReviewScreen setKey={setKey} />;
  },
});
