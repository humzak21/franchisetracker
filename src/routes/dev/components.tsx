import { createFileRoute } from "@tanstack/react-router";
import { GalleryScreen } from "@/features/dev-gallery/GalleryScreen";

export const Route = createFileRoute("/dev/components")({ component: GalleryScreen });
