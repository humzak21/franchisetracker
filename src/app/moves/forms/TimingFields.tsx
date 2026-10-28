import type { Id } from "@convex/_generated/dataModel";
import {
  TRANSACTION_PHASE_LABELS,
  TRANSACTION_PHASES,
  weekLabel,
  type TransactionPhase,
  type WeekKey,
} from "@shared/domain";
import { weeksForPhase } from "@shared/transactions";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/forms/Field";
import type { Timing } from "./moveForm";

const PHASE_OPTIONS = TRANSACTION_PHASES.map((p) => ({ value: p, label: TRANSACTION_PHASE_LABELS[p] }));

/** When a move happened: the season, the phase of the league year and, in season, the week. */
export function TimingFields({
  seasons,
  value,
  onChange,
}: {
  seasons: readonly { _id: Id<"seasons">; year: number }[];
  value: Timing;
  onChange: (next: Timing) => void;
}) {
  const weeks = weeksForPhase(value.phase);
  const setPhase = (phase: TransactionPhase) => {
    const options = weeksForPhase(phase);
    // Keep the week when it still fits the phase; otherwise start at the phase's first week.
    const weekKey = value.weekKey && options.includes(value.weekKey) ? value.weekKey : options[0];
    onChange({ ...value, phase, weekKey });
  };
  return (
    <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3">
      <Field label="Season">
        <Select
          value={value.seasonId}
          options={seasons.map((s) => ({ value: s._id, label: String(s.year) }))}
          onValueChange={(id) => onChange({ ...value, seasonId: id as Id<"seasons"> })}
        />
      </Field>
      <Field label="When">
        <Select
          value={value.phase}
          options={PHASE_OPTIONS}
          onValueChange={(phase) => setPhase(phase as TransactionPhase)}
        />
      </Field>
      {weeks.length > 0 && (
        <Field label="Week">
          <Select
            value={value.weekKey ?? ""}
            options={weeks.map((w) => ({ value: w, label: weekLabel(w, "long") }))}
            onValueChange={(w) => onChange({ ...value, weekKey: w as WeekKey })}
          />
        </Field>
      )}
    </div>
  );
}
