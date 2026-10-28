import { useCallback, useMemo, useState } from "react";

export type Selection<K extends string> = {
  /** Picked keys still among `keys`, in the order they were picked. */
  picked: K[];
  has: (key: K) => boolean;
  toggle: (key: K) => void;
  /** Picks every key, or clears them all when every key is already picked. */
  toggleAll: () => void;
  clear: () => void;
  /** Every key picked, some, or none: what a select-all box shows. */
  state: boolean | "mixed";
};

/**
 * Rows picked for a batch action. Keys that leave the list (a filter, a released player) drop out
 * of the selection on their own, so an action never reaches a row the user can no longer see.
 */
export function useSelection<K extends string>(keys: readonly K[], max?: number): Selection<K> {
  const [chosen, setChosen] = useState<K[]>([]);
  const present = useMemo(() => new Set(keys), [keys]);
  const picked = useMemo(() => chosen.filter((k) => present.has(k)), [chosen, present]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const toggle = useCallback(
    (key: K) =>
      setChosen((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(0, max ?? Infinity),
      ),
    [max],
  );
  const all = keys.length > 0 && keys.every((k) => pickedSet.has(k));
  const toggleAll = useCallback(() => setChosen(all ? [] : [...keys]), [all, keys]);
  const clear = useCallback(() => setChosen([]), []);
  const has = useCallback((key: K) => pickedSet.has(key), [pickedSet]);
  return {
    picked,
    has,
    toggle,
    toggleAll,
    clear,
    state: all ? true : picked.length > 0 ? "mixed" : false,
  };
}
