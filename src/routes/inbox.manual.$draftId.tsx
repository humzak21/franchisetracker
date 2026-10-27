import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "@convex/_generated/dataModel";
import { NotFoundScreen } from "@/app/shell/StatusScreens";
import { ManualEntryScreen } from "@/features/ingestion/manual/ManualEntryScreen";

export const Route = createFileRoute("/inbox/manual/$draftId")({
  component: function ManualEntryRoute() {
    const { draftId } = Route.useParams();
    return <ManualEntryScreen key={draftId} draftId={draftId as Id<"manualDrafts">} />;
  },
  // A discarded or malformed entry fails the query; show the same page as an unknown route.
  errorComponent: NotFoundScreen,
});
