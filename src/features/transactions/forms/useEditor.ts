import { useCallback, useState } from "react";
import type { Editing } from "./moveForm";

type EditorState = { editing: Editing | null; session: number; open: boolean };

/** Which sheet is open; each open starts a fresh session so the form resets. */
export function useEditor() {
  const [state, setState] = useState<EditorState>({ editing: null, session: 0, open: false });
  const openEditor = useCallback(
    (editing: Editing) => setState((s) => ({ editing, session: s.session + 1, open: true })),
    [],
  );
  const onOpenChange = useCallback((open: boolean) => setState((s) => ({ ...s, open })), []);
  return { ...state, openEditor, onOpenChange };
}
