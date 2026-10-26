import { useCallback, useEffect, useState } from "react";

const EVENT = "ft:local-storage";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/**
 * Per-device preferences (theme, table columns, remembered season). Never for franchise data,
 * which lives in Convex. Instances sharing a key stay in sync within the tab.
 */
export function useLocalStorage<T>(key: string, fallback: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    const sync = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== key) return;
      if (event instanceof CustomEvent && event.detail !== key) return;
      setValue(read(key, fallback));
    };
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
    // fallback is intentionally excluded: callers pass literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
          queueMicrotask(() => window.dispatchEvent(new CustomEvent(EVENT, { detail: key })));
        } catch {
          // Storage can be unavailable (private mode); the in-memory value still works.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}
