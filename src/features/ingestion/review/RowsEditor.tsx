import { CheckCheck, Plus } from "lucide-react";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { emptyRow, type NewEntry } from "@shared/ingestion/manual";
import { isRowDraft, rowTarget } from "@shared/ingestion/targets";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { AddPlayerSheet } from "./AddPlayerSheet";
import { RowCard } from "./RowCard";
import { RowFieldInput } from "./RowFieldInput";
import { useReviewDraft } from "./reviewDraft";

/**
 * A list screen's draft (leaders, standings, a roster page): the screen's own fields, then one
 * card per row. Rows the model was sure of start accepted; only accepted rows commit. Rows the
 * screens missed, or a whole list typed in by hand, are added one at a time.
 */
export function RowsEditor() {
  const { draft, set, update, flag } = useReviewDraft();
  const [adding, setAdding] = useState(false);
  if (!isRowDraft(draft)) return null;
  const { spec } = rowTarget(draft.target);
  const fields = spec.fields(draft);
  const accepted = draft.rows.filter((r) => r.accepted).length;
  const addRow = (who?: NewEntry<Id<"players">>) =>
    update((d) => (isRowDraft(d) ? { ...d, rows: [...d.rows, emptyRow(spec, d, who)] } : d));

  return (
    <div className="space-y-5">
      {spec.meta.length > 0 && (
        <Section title="Screen" variant="card">
          <div className="grid gap-3 sm:grid-cols-2">
            {spec.meta.map((field) => (
              <RowFieldInput
                key={field.key}
                field={field}
                value={draft.meta[field.key]}
                flag={flag(`meta.${field.key}`)}
                onChange={(v) => set(`meta.${field.key}`, v ?? null)}
              />
            ))}
          </div>
        </Section>
      )}
      <Section
        title="Rows"
        description={`${accepted} of ${draft.rows.length} accepted · only accepted rows are committed`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => (spec.player ? setAdding(true) : addRow())}>
              <Plus /> Add row
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={accepted === draft.rows.length}
              onClick={() =>
                update((d) =>
                  "rows" in d ? { ...d, rows: d.rows.map((r) => ({ ...r, accepted: true })) } : d,
                )
              }
            >
              <CheckCheck /> Accept all
            </Button>
          </div>
        }
      >
        {draft.rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No rows yet. Add the first one.</p>
        )}
        <ul className="@container grid gap-3 @3xl:grid-cols-2">
          {draft.rows.map((row) => (
            <li key={row.id}>
              <RowCard row={row} fields={fields} player={spec.player} rowTeam={spec.rowTeam} />
            </li>
          ))}
        </ul>
      </Section>
      {spec.player && (
        <AddPlayerSheet open={adding} onOpenChange={setAdding} title="Add a row" onAdd={addRow} />
      )}
    </div>
  );
}
