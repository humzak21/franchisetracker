import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import type { Density } from "./TableOptions";

type Prefs = { primary?: string[]; hidden?: string[]; density?: Density };

/** Remembered per-table choices: phone primary columns, desktop hidden columns, density. */
export function useColumnPrefs(tableId: string, defaultPrimary: readonly string[]) {
  const [prefs, setPrefs] = useLocalStorage<Prefs>(`ft.table.${tableId}`, {});
  const primary = prefs.primary ?? [...defaultPrimary];
  const hidden = new Set(prefs.hidden ?? []);

  const togglePrimary = (id: string) =>
    setPrefs((p) => {
      const current = p.primary ?? [...defaultPrimary];
      return { ...p, primary: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] };
    });
  const toggleHidden = (id: string) =>
    setPrefs((p) => {
      const current = new Set(p.hidden ?? []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...p, hidden: [...current] };
    });

  return {
    primary,
    hidden,
    density: prefs.density ?? "compact",
    setDensity: (density: Density) => setPrefs((p) => ({ ...p, density })),
    togglePrimary,
    toggleHidden,
    reset: () => setPrefs({}),
  };
}
