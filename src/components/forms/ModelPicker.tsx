import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ModelPickerProps = {
  /** OpenRouter model ids to choose from. */
  presets: readonly string[];
  value: string;
  onChange: (model: string) => void;
  "aria-label": string;
};

const OTHER = "__other";

/**
 * Picks an OpenRouter model from saved presets, or "Other model…" to type an id. Native select,
 * so the phone opens its own picker.
 */
export function ModelPicker({ presets, value, onChange, "aria-label": label }: ModelPickerProps) {
  const [typing, setTyping] = useState(false);
  const other = typing || !presets.includes(value);
  return (
    <div className="space-y-2">
      <Select
        aria-label={label}
        value={other ? OTHER : value}
        onValueChange={(next) => {
          setTyping(next === OTHER);
          onChange(next === OTHER ? "" : next);
        }}
        options={[
          ...presets.map((model) => ({ value: model, label: model })),
          { value: OTHER, label: "Other model…" },
        ]}
      />
      {other && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="vendor/model"
          aria-label={`${label} id`}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      )}
    </div>
  );
}
