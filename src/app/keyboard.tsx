import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Shortcut = {
  /** `KeyboardEvent.key`, lowercase for letters ("k", "i", "[", "?"). */
  key: string;
  /** Requires ⌘ on Mac or Ctrl elsewhere. */
  mod?: boolean;
  label: string;
  /** How the same action is reached on a phone, shown in the shortcut sheet. */
  touch?: string;
  handler: () => void;
};

type Registry = {
  register: (id: string, shortcut: Shortcut) => () => void;
  list: () => Shortcut[];
  version: number;
};

const KeyboardContext = createContext<Registry | null>(null);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Global keyboard shortcuts. Screens register theirs with `useShortcut`; plain keys are ignored while typing. */
export function KeyboardProvider({ children }: { children: ReactNode }) {
  const shortcuts = useRef(new Map<string, Shortcut>());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      for (const s of shortcuts.current.values()) {
        if (e.key.toLowerCase() !== s.key || !!s.mod !== mod || e.altKey) continue;
        if (!s.mod && isTyping(e.target)) continue;
        e.preventDefault();
        s.handler();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const registry: Registry = {
    register: (id, shortcut) => {
      shortcuts.current.set(id, shortcut);
      setVersion((v) => v + 1);
      return () => {
        shortcuts.current.delete(id);
        setVersion((v) => v + 1);
      };
    },
    list: () => [...shortcuts.current.values()],
    version,
  };

  return <KeyboardContext.Provider value={registry}>{children}</KeyboardContext.Provider>;
}

export function useShortcut(id: string, shortcut: Shortcut) {
  const ctx = useContext(KeyboardContext);
  const latest = useRef(shortcut);
  useEffect(() => {
    latest.current = shortcut;
  });
  const { key, mod, label, touch } = shortcut;
  useEffect(() => {
    if (!ctx) return;
    return ctx.register(id, { key, mod, label, touch, handler: () => latest.current.handler() });
    // ctx identity changes on every registration; register once per shortcut definition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key, mod, label, touch]);
}

export function useShortcutList(): Shortcut[] {
  const ctx = useContext(KeyboardContext);
  return ctx ? ctx.list() : [];
}
