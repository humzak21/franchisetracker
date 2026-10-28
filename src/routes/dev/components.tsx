import { createFileRoute } from "@tanstack/react-router";
import { GalleryScreen } from "@/features/dev-gallery/GalleryScreen";

export const Route = createFileRoute("/dev/components")({
  validateSearch: (search: Record<string, unknown>): { only?: string } =>
    typeof search.only === "string" ? { only: search.only } : {},
  component: function GalleryRoute() {
    const { only } = Route.useSearch();
    return <GalleryScreen only={only} />;
  },
});
