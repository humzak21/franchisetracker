import { useState, type KeyboardEvent } from "react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import type { ColumnEdit, EditValue } from "./types";

type EditableCellProps<T> = {
  row: T;
  edit: ColumnEdit<T>;
  label: string;
  align: "left" | "right" | "center";
  onSave: (value: EditValue) => Promise<unknown> | void;
};

const toText = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** One cell in a table's edit mode. Saves on blur or Enter when the value changed; Escape reverts. */
export function EditableCell<T>({ row, edit, label, align, onSave }: EditableCellProps<T>) {
  const initial = toText(edit.get(row));
  const [draft, setDraft] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A save elsewhere (or a reactive update) moves the cell to the new value unless it is mid-edit.
  if (initial !== seen) {
    setSeen(initial);
    if (draft === seen) setDraft(initial);
  }

  const parse = (text: string): EditValue | undefined => {
    const trimmed = text.trim();
    if (trimmed === "") return null;
    if (edit.kind !== "number") return trimmed;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return undefined;
    if ((edit.min !== undefined && n < edit.min) || (edit.max !== undefined && n > edit.max))
      return undefined;
    return n;
  };

  const commit = async (text: string) => {
    if (text === initial) return;
    const value = parse(text);
    if (value === undefined) {
      setError("Not a valid number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
    } catch (err) {
      setError(errorMessage(err, "Could not save"));
      setDraft(initial);
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      setDraft(initial);
      setError(null);
      e.currentTarget.blur();
    }
  };

  const frame = cn(
    "h-7 rounded-md border bg-surface px-1.5 text-[13px] text-foreground focus-visible:border-primary focus-visible:outline-none pointer-coarse:h-9 pointer-coarse:text-base",
    error ? "border-loss" : "border-input",
    saving && "opacity-60",
  );

  if (edit.kind === "select") {
    return (
      <span onClick={(e) => e.stopPropagation()} title={error ?? undefined} className="inline-flex min-w-28">
        <Select
          aria-label={label}
          value={draft}
          options={edit.options}
          placeholder="—"
          onValueChange={(value) => {
            setDraft(value);
            void commit(value);
          }}
          className="[&_select]:h-7 [&_select]:text-[13px] pointer-coarse:[&_select]:h-9"
        />
      </span>
    );
  }

  return (
    <input
      aria-label={label}
      title={error ?? undefined}
      aria-invalid={error !== null || undefined}
      value={draft}
      inputMode={edit.kind === "number" ? "decimal" : undefined}
      placeholder={edit.kind === "text" ? edit.placeholder : undefined}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => void commit(e.target.value)}
      onKeyDown={onKey}
      className={cn(frame, edit.kind === "number" ? "num w-16" : "w-36", align === "right" && "text-right")}
    />
  );
}
