import { useId } from "react";
import { NFL_TEAMS, POSITIONS } from "@shared/domain";
import type { RowField, RowValue } from "@shared/ingestion/rows/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { NumberField, type FieldFlag } from "./NumberField";

const TEAM_OPTIONS = NFL_TEAMS.map((t) => ({ value: t.abbr, label: `${t.abbr} · ${t.city} ${t.name}` }));
const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p, label: p }));
const BOOL_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const flagRing: Record<Exclude<FieldFlag, null>, string> = {
  error: "rounded-lg ring-2 ring-loss",
  warning: "rounded-lg ring-2 ring-warn",
  doubt: "rounded-lg ring-1 ring-warn/60",
};

/** One field of a row or a screen, in the control its type calls for; `undefined` clears it. */
export function RowFieldInput({
  field,
  value,
  flag,
  onChange,
  className,
}: {
  field: RowField;
  value: RowValue | undefined;
  flag: FieldFlag;
  onChange: (value: RowValue | undefined) => void;
  className?: string;
}) {
  const id = useId();
  if (field.type === "int" || field.type === "number") {
    return (
      <NumberField
        className={className}
        label={field.label}
        value={typeof value === "number" ? value : undefined}
        flag={flag}
        onChange={(v) => onChange(v === undefined ? undefined : field.type === "int" ? Math.round(v) : v)}
      />
    );
  }
  const label = (
    <label htmlFor={id} className="block truncate text-[11px] text-muted-foreground" title={field.label}>
      {field.label}
    </label>
  );
  if (field.type === "text") {
    return (
      <div className={cn("min-w-0", className)}>
        {label}
        <Input
          id={id}
          className={cn("mt-0.5", flag && flagRing[flag])}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      </div>
    );
  }
  const options =
    field.type === "team"
      ? TEAM_OPTIONS
      : field.type === "position"
        ? POSITION_OPTIONS
        : field.type === "bool"
          ? BOOL_OPTIONS
          : (field.options ?? []);
  const selected =
    field.type === "bool" ? (value === true ? "yes" : value === false ? "no" : "") : String(value ?? "");
  return (
    <div className={cn("min-w-0", className)}>
      {label}
      <Select
        id={id}
        className={cn("mt-0.5", flag && flagRing[flag])}
        value={selected}
        placeholder="—"
        options={options}
        onValueChange={(next) => onChange(field.type === "bool" ? next === "yes" : next)}
      />
    </div>
  );
}
