import { createContext, useContext } from "react";

/**
 * Cached logo URLs keyed by team abbreviation. The app fills it from Convex storage once, so
 * every `TeamLogo` shows the real logo without each query carrying a URL; components stay free
 * of `app/` imports (the PageChrome pattern).
 */
const TeamLogosContext = createContext<Readonly<Record<string, string>>>({});

export const TeamLogosProvider = TeamLogosContext.Provider;

export function useTeamLogoUrl(abbr: string): string | undefined {
  return useContext(TeamLogosContext)[abbr];
}
