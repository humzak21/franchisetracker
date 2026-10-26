import { useEffect, type RefObject } from "react";

type SwipeHandlers = { onSwipeLeft?: () => void; onSwipeRight?: () => void };

/**
 * Horizontal swipe detection for touch pointers. Ignores mostly vertical drags so scrolling
 * stays natural, and gestures that start inside a horizontally scrollable strip.
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight }: SwipeHandlers,
  threshold = 56,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number } | null = null;

    const insideScroller = (target: EventTarget | null) =>
      target instanceof Element && target.closest("[data-swipe-ignore]") !== null;

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || insideScroller(e.target)) return;
      start = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    };
    const cancel = () => (start = null);

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [ref, onSwipeLeft, onSwipeRight, threshold]);
}
