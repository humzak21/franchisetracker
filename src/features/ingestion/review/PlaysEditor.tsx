import { CheckCheck, ListX, Plus } from "lucide-react";
import { emptyRow } from "@shared/ingestion/manual";
import { scoringPlaysSpec as spec } from "@shared/ingestion/rows/scoringSpec";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { RowCard } from "./RowCard";
import { useReviewDraft } from "./reviewDraft";

/**
 * A full game log's scoring plays, as the row cards a scoring summary gets on its own. Optional:
 * a log with no scoring screen, or with every play left out, commits without touching the plays.
 */
export function PlaysEditor() {
  const { draft, update } = useReviewDraft();
  if (draft.target !== "game_log") return null;
  const plays = draft.plays ?? [];
  const accepted = plays.filter((p) => p.accepted).length;
  const allAccepted = plays.length > 0 && accepted === plays.length;
  const fields = spec.fields();

  return (
    <Section
      title="Scoring plays"
      description={`${accepted} of ${plays.length} accepted · only accepted plays are committed`}
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update((d) => {
                if (d.target !== "game_log") return d;
                const rows = d.plays ?? [];
                const row = emptyRow(spec, { target: "scoring_plays", meta: {}, rows });
                return { ...d, plays: [...rows, row] };
              })
            }
          >
            <Plus /> Add play
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={plays.length === 0}
            onClick={() =>
              update((d) =>
                d.target === "game_log"
                  ? { ...d, plays: d.plays?.map((p) => ({ ...p, accepted: !allAccepted })) }
                  : d,
              )
            }
          >
            {allAccepted ? <ListX /> : <CheckCheck />} {allAccepted ? "Deselect all" : "Select all"}
          </Button>
        </div>
      }
    >
      {plays.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No scoring summary in this upload. Add one here, or capture it later from the game.
        </p>
      )}
      <ul className="@container grid gap-3 @3xl:grid-cols-2">
        {plays.map((row) => (
          <li key={row.id}>
            <RowCard row={row} spec={spec} fields={fields} collection="plays" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
