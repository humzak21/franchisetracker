import { useEffect, useRef, type RefObject } from "react";

/**
 * Scrolls the element fully into view whenever `key` changes after the first render, so content
 * that grows on a tab switch is not left below the fold. The element's `scroll-margin` keeps it
 * clear of sticky headers and the phone tab bar; one taller than the viewport lines up its top.
 */
export function useRevealOnChange(ref: RefObject<HTMLElement | null>, key: string) {
  const first = useRef(key);
  useEffect(() => {
    if (key === first.current) return;
    first.current = key;
    // After layout: the new tab's rows have to be in the DOM before measuring.
    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const style = getComputedStyle(el);
      const top = parseFloat(style.scrollMarginTop) || 0;
      const bottom = parseFloat(style.scrollMarginBottom) || 0;
      const rect = el.getBoundingClientRect();
      const room = window.innerHeight - top - bottom;
      const hidden = rect.bottom > window.innerHeight - bottom || rect.top < top;
      if (!hidden) return;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      el.scrollIntoView({ block: rect.height > room ? "start" : "end", behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [ref, key]);
}
