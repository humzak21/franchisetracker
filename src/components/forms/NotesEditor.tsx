import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Textarea } from "@/components/ui/textarea";

type SaveState = "idle" | "saving" | "saved" | "error";

type NotesEditorProps = {
  label: string;
  value: string | undefined;
  onSave: (next: string) => Promise<unknown>;
  /** Every keystroke, for callers that act on the unsaved text (a "file report" button). */
  onDraftChange?: (draft: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
};

/**
 * Free-text notes that save on blur (FEATURES.md 5.13: autosave, works with the on-screen
 * keyboard). Picks up remote changes while the field is not being edited.
 */
export function NotesEditor({
  label,
  value,
  onSave,
  onDraftChange,
  placeholder,
  rows = 6,
  className,
}: NotesEditorProps) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(value ?? "");
  }, [value]);

  useEffect(() => onDraftChange?.(draft), [draft, onDraftChange]);

  const save = async () => {
    editing.current = false;
    if (draft === (value ?? "")) return;
    setState("saving");
    try {
      await onSave(draft);
      setState("saved");
    } catch {
      setState("error");
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase"
        >
          {label}
        </label>
        <span aria-live="polite" className="flex items-center gap-1 text-xs text-muted-foreground">
          {state === "saving" && <LoaderCircle className="size-3 animate-spin" />}
          {state === "saving" && "Saving"}
          {state === "saved" && <Check className="size-3 text-win" />}
          {state === "saved" && "Saved"}
          {state === "error" && <span className="text-loss">Not saved. Try again.</span>}
        </span>
      </div>
      <Textarea
        id={id}
        value={draft}
        rows={rows}
        placeholder={placeholder}
        onFocus={() => (editing.current = true)}
        onChange={(e) => {
          setDraft(e.target.value);
          setState("idle");
        }}
        onBlur={() => void save()}
      />
    </div>
  );
}
