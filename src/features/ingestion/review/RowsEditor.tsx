import { CheckCheck } from "lucide-react";
import { isRowDraft, rowTarget } from "@shared/ingestion/targets";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { RowCard } from "./RowCard";
import { RowFieldInput } from "./RowFieldInput";
import { useReviewDraft } from "./reviewDraft";

/**
 * A list screen's draft (leaders, standings, a roster page): the screen's own fields, then one
 * card per row. Rows the model was sure of start accepted; only accepted rows commit.
 */
export function RowsEditor() {
  const { draft, set, update, flag } = useReviewDraft();
  if (!isRowDraft(draft)) return null;
  const { spec } = rowTarget(draft.target);
  const fields = spec.fields(draft);
  const accepted = draft.rows.filter((r) => r.accepted).length;

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
          <Button
            size="sm"
            variant="outline"
            disabled={accepted === draft.rows.length}
            onClick={() =>
              update((d) => ("rows" in d ? { ...d, rows: d.rows.map((r) => ({ ...r, accepted: true })) } : d))
            }
          >
            <CheckCheck /> Accept all
          </Button>
        }
      >
        <ul className="@container grid gap-3 @3xl:grid-cols-2">
          {draft.rows.map((row) => (
            <li key={row.id}>
              <RowCard row={row} fields={fields} player={spec.player} rowTeam={spec.rowTeam} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
