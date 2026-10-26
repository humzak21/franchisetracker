import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { isNeutral, readableAccent, readableOn } from "./color";

export type ThemeMode = "light" | "dark" | "system";
export type TeamColors = { primaryColor: string; secondaryColor: string };

const BACKGROUNDS = { dark: "#0b0f17", light: "#fafbfc" } as const;

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** CSS variables for a team, resolved for the current theme. Pure so the gallery can preview any team. */
export function teamCssVars(team: TeamColors, resolved: "light" | "dark"): Record<string, string> {
  const candidates = [team.primaryColor, team.secondaryColor].filter((c) => !isNeutral(c));
  const accent = readableAccent(candidates.length ? candidates : [team.primaryColor], BACKGROUNDS[resolved]);
  return {
    "--team-primary": team.primaryColor,
    "--team-secondary": team.secondaryColor,
    "--team-primary-foreground": readableOn(team.primaryColor),
    "--team-accent": accent,
    "--team-accent-foreground": readableOn(accent),
  };
}

export function ThemeProvider({ team, children }: { team?: TeamColors | null; children: ReactNode }) {
  const [mode, setMode] = useLocalStorage<ThemeMode>("ft.theme", "dark");
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved = mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BACKGROUNDS[resolved]);
  }, [resolved]);

  useEffect(() => {
    if (!team) return;
    const root = document.documentElement.style;
    for (const [name, value] of Object.entries(teamCssVars(team, resolved))) root.setProperty(name, value);
  }, [team, resolved]);

  const toggle = useCallback(() => setMode(resolved === "dark" ? "light" : "dark"), [resolved, setMode]);
  const value = useMemo(() => ({ mode, resolved, setMode, toggle }), [mode, resolved, setMode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

/** Local theme scope: renders children with a forced theme and optional team, without touching the document. */
export function ThemeScope({
  theme,
  team,
  className,
  children,
}: {
  theme: "light" | "dark";
  team?: TeamColors;
  className?: string;
  children: ReactNode;
}) {
  const style = useMemo(() => (team ? teamCssVars(team, theme) : {}), [team, theme]);
  return (
    <div
      className={`${theme === "dark" ? "dark" : "light"} bg-background text-foreground ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
