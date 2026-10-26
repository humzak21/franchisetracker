import { useRouterState } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { currentSeason, useFranchise, type Season } from "./franchise";
import { sectionOf } from "./nav";

type SeasonContextValue = {
  seasons: readonly Season[];
  /** Selected season for the current screen; defaults to the franchise's current season. */
  season: Season | undefined;
  setYear: (year: number) => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
};

const SeasonContext = createContext<SeasonContextValue | null>(null);

/** Season selection, remembered per screen (FEATURES.md 3). */
export function SeasonProvider({ children }: { children: ReactNode }) {
  const active = useFranchise();
  const section = useRouterState({ select: (s) => sectionOf(s.location.pathname) });
  const [bySection, setBySection] = useLocalStorage<Record<string, number>>("ft.season-by-screen", {});
  const [pickerOpen, setPickerOpen] = useState(false);

  const seasons = useMemo(() => active?.seasons ?? [], [active]);
  const remembered = bySection[section];
  const season = seasons.find((s) => s.year === remembered) ?? currentSeason(seasons);

  const setYear = useCallback(
    (year: number) => setBySection((prev) => ({ ...prev, [section]: year })),
    [section, setBySection],
  );

  const value = useMemo(
    () => ({ seasons, season, setYear, pickerOpen, setPickerOpen }),
    [seasons, season, setYear, pickerOpen],
  );
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason(): SeasonContextValue {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error("useSeason must be used inside SeasonProvider");
  return ctx;
}
