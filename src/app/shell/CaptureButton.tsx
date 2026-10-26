import { useRouterState } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCapture } from "../capture/CaptureProvider";

/** Captures waiting offline, shown on the capture buttons so nothing seems lost. */
function QueuedBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} waiting to upload`}
      className="num absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-warn px-1 text-[11px] leading-5 font-bold text-black"
    >
      {count}
    </span>
  );
}

/** Header capture button (tablet and desktop). Opens the capture sheet. */
export function CaptureButton() {
  const { open, queued } = useCapture();
  return (
    <Button variant="primary" size="sm" className="relative" onClick={() => open()}>
      <Camera /> Capture
      <QueuedBadge count={queued} />
    </Button>
  );
}

/** Floating capture button for phones, sitting above the tab bar. Review pages hide it for their action bar. */
export function CaptureFab() {
  const { open, queued } = useCapture();
  const reviewing = useRouterState({ select: (s) => s.location.pathname.startsWith("/inbox/") });
  if (reviewing) return null;
  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label="Capture screenshots"
      className="shadow-elevated fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-background transition-transform active:scale-95 sm:hidden"
    >
      <Camera className="size-6" />
      <QueuedBadge count={queued} />
    </button>
  );
}
