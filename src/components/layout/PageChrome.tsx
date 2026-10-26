import { createContext, useContext, type ReactNode } from "react";

/**
 * Slots the app shell fills for every page header (season switcher, search, capture, banner).
 * Lets layout components render app-level controls without importing from `app/`.
 */
export type PageChrome = {
  seasonSwitcher: ReactNode;
  openSearch: () => void;
  capture: ReactNode;
  /** Shown under the header on every page: the pending-report banner. */
  banner: ReactNode;
};

const PageChromeContext = createContext<PageChrome | null>(null);

export const PageChromeProvider = PageChromeContext.Provider;

export function usePageChrome(): PageChrome | null {
  return useContext(PageChromeContext);
}
