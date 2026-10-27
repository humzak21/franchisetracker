import { Input } from "@/components/ui/input";
import { Field } from "./Field";
import type { ContractDraft } from "./moveForm";

const FIELDS: { key: keyof ContractDraft; label: string; placeholder: string }[] = [
  { key: "years", label: "Years", placeholder: "3" },
  { key: "total", label: "Total ($M)", placeholder: "60" },
  { key: "apy", label: "Per year ($M)", placeholder: "20" },
  { key: "guaranteed", label: "Guaranteed ($M)", placeholder: "35" },
];

/** Contract terms: years and money in millions. Per year fills from the total when left blank. */
export function ContractFields({
  value,
  onChange,
}: {
  value: ContractDraft;
  onChange: (next: ContractDraft) => void;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-2 @sm:grid-cols-4">
      <legend className="sr-only">Contract</legend>
      {FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <Input
            inputMode={f.key === "years" ? "numeric" : "decimal"}
            placeholder={f.placeholder}
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value.replace(/[^\d.]/g, "") })}
          />
        </Field>
      ))}
    </fieldset>
  );
}
