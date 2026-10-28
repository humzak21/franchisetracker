import { Field } from "@/components/forms/Field";
import { Textarea } from "@/components/ui/textarea";

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
      <Textarea
        rows={2}
        maxLength={2000}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
