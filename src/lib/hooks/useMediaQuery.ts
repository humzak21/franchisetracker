import { useSyncExternalStore } from "react";

/** Viewport media query. Only the app shell should use this; components use container width. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const PHONE_QUERY = "(max-width: 639px)";
export const DESKTOP_QUERY = "(min-width: 1024px)";
