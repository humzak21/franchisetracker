import { Field } from "./Field";

/** The optional note on a move or an injury. */
export function NotesField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label="Note (optional)">
      <textarea
        rows={2}
        maxLength={2000}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:outline-none pointer-coarse:text-base"
      />
    </Field>
  );
}
