import { useLayoutEffect, useRef, useState } from "react";

/** Phone layout applies under 640 px of available width (FEATURES.md 7). */
export const COMPACT_WIDTH = 640;

/**
 * Tracks an element's width. Components switch layout on their own width rather than the
 * viewport, so a table inside a narrow pane, or the gallery's phone frame, gets the phone layout.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width, compact: width !== null && width < COMPACT_WIDTH };
}
