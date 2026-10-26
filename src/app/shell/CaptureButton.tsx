import { Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Header capture button (tablet and desktop). Opens the inbox uploader; the uploader lands in Sprint 2. */
export function CaptureButton() {
  return (
    <Button asChild variant="primary" size="sm">
      <Link to="/inbox">
        <Camera /> Capture
      </Link>
    </Button>
  );
}

/** Floating capture button for phones, sitting above the tab bar. */
export function CaptureFab() {
  return (
    <Link
      to="/inbox"
      aria-label="Capture screenshots"
      className="shadow-elevated fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-background transition-transform active:scale-95 sm:hidden"
    >
      <Camera className="size-6" />
    </Link>
  );
}
