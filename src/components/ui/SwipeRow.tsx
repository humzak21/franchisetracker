import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** How far a row travels before letting go triggers the action. */
const TRIGGER_PX = 88;
const MAX_PX = 128;
/** Movement before deciding whether the gesture is a horizontal swipe or a scroll. */
const SLOP_PX = 8;

type Gesture = { x: number; y: number; pointerId: number; swiping: boolean | null };

/**
 * A list row that swipes left to reveal and run one action (resolve a need, archive), the
 * phone gesture of FEATURES.md 5.13. Vertical drags still scroll; a short swipe springs back.
 * The action must also be reachable another way (a button in the row) for mouse and keyboard.
 */
export function SwipeRow({
  children,
  action,
  onAction,
  disabled,
  className,
}: {
  children: ReactNode;
  /** What is revealed behind the row: an icon and a word. */
  action: ReactNode;
  onAction: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [offset, setOffsetState] = useState(0);
  // Read on release, which can come before React renders the last move.
  const latest = useRef(0);
  const setOffset = (value: number) => {
    latest.current = value;
    setOffsetState(value);
  };
  const gesture = useRef<Gesture | null>(null);
  const swiped = useRef(false);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    // Reset first: a row disabled by its own swipe (a resolved need) must still take taps.
    swiped.current = false;
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    gesture.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, swiping: null };
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.swiping === null) {
      if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return;
      g.swiping = Math.abs(dx) > Math.abs(dy) && dx < 0;
      if (g.swiping) {
        // Capture is best effort: a pointer the browser no longer tracks throws, and the
        // swipe still follows it without capture.
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // not capturable
        }
      }
    }
    if (!g.swiping) return;
    swiped.current = true;
    setOffset(Math.max(-MAX_PX, Math.min(0, dx)));
  };

  const up = () => {
    // After the release's own events (click, focus) have run, so a sheet the action opens stays open.
    if (gesture.current?.swiping && latest.current <= -TRIGGER_PX) window.setTimeout(onAction, 0);
    gesture.current = null;
    setOffset(0);
  };

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)} data-swipe-ignore>
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end gap-2 bg-win px-5 text-sm font-semibold text-white"
        style={{ opacity: Math.min(1, -offset / TRIGGER_PX) }}
      >
        {action}
      </div>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        // A swipe that ends over a button must not also press it.
        onClickCapture={(e) => {
          if (!swiped.current) return;
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          "relative touch-pan-y bg-surface select-none",
          offset === 0 && "duration-200 ease-out motion-safe:transition-transform",
        )}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
