import { Check, ChevronDown, ChevronRight, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import type { RowField } from "@shared/ingestion/rows/types";
import type { RowTargetDraft } from "@shared/ingestion/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { choosePlayerAt } from "./draftEdit";
import { PlayerPickerSheet } from "./PlayerPickerSheet";
import { useReviewDraft } from "./reviewDraft";
import { RowFieldInput } from "./RowFieldInput";

type Row = RowTargetDraft<Id<"players">>["rows"][number];

const TEAM: RowField = { key: "teamAbbr", label: "Team", type: "team" };

function Who({ row, onPick, flagged }: { row: Row; onPick: () => void; flagged: boolean }) {
  const chosen = row.match?.candidates.find((c) => c.playerId === row.playerId);
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "-m-1 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left hover:bg-surface-2",
        flagged && "bg-warn/10",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{row.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {chosen ? (
            <>→ {chosen.name}</>
          ) : row.playerId ? (
            "→ Chosen player"
          ) : row.match?.status === "ambiguous" ? (
            <span className="text-warn">Choose who this is</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <UserPlus className="size-3" /> New player
            </span>
          )}
        </span>
      </span>
      <ChevronRight className="ml-auto size-4 shrink-0 text-subtle-foreground" />
    </button>
  );
}

/**
 * One row of a list screen as a card: accept it, fix who it is, and its fields; the primary ones
 * in view and the rest a tap away, so a long list can be reviewed with thumbs (FEATURES.md 9).
 */
export function RowCard({
  row,
  fields,
  player,
  rowTeam,
}: {
  row: Row;
  fields: readonly RowField[];
  player: boolean;
  rowTeam: boolean;
}) {
  const { set, update, flag } = useReviewDraft();
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState(false);
  const base = `rows.${row.id}`;
  // Empty optional fields wait under "more": a passer's card does not lead with blank carries.
  const inView = (f: RowField) => f.primary && (f.required || (row.values[f.key] ?? null) !== null);
  const primary = fields.filter(inView);
  const rest = fields.filter((f) => !inView(f));
  const flagged = (f: RowField) => flag(`${base}.values.${f.key}`) !== null;
  // A doubtful or broken secondary field opens the card so it is not missed.
  const expanded = open || rest.some(flagged);
  const title = player ? null : (row.teamAbbr ?? "Row");
  const label = row.name ?? row.teamAbbr ?? "row";

  return (
    <article
      className={cn(
        "rounded-xl border bg-surface transition-colors",
        row.accepted ? "border-win/60" : "border-border",
        fields.some((f) => flag(`${base}.values.${f.key}`) === "error") && row.accepted && "border-loss",
      )}
    >
      <header className="flex items-center gap-2 border-b border-border p-2.5">
        <Button
          size="icon"
          variant={row.accepted ? "primary" : "outline"}
          aria-pressed={row.accepted}
          aria-label={`Accept ${label}`}
          onClick={() => set(`${base}.accepted`, !row.accepted)}
          className={row.accepted ? "bg-win text-white" : undefined}
        >
          <Check />
        </Button>
        {player ? (
          <Who row={row} onPick={() => setPicking(true)} flagged={flag(`${base}.name`) !== null} />
        ) : (
          <span className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title}</span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${label}`}
          onClick={() =>
            update((d) => ("rows" in d ? { ...d, rows: d.rows.filter((r) => r.id !== row.id) } : d))
          }
        >
          <Trash2 />
        </Button>
      </header>
      <div className="@container space-y-2 p-2.5">
        <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3 @lg:grid-cols-4">
          {rowTeam && (
            <RowFieldInput
              field={TEAM}
              value={row.teamAbbr}
              flag={flag(`${base}.teamAbbr`)}
              onChange={(v) => set(`${base}.teamAbbr`, v ?? null)}
            />
          )}
          {primary.map((f) => (
            <RowFieldInput
              key={f.key}
              field={f}
              value={row.values[f.key]}
              flag={flag(`${base}.values.${f.key}`)}
              onChange={(v) => set(`${base}.values.${f.key}`, v)}
            />
          ))}
        </div>
        {rest.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(!expanded)}
              className="flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Fewer fields" : `${rest.length} more field${rest.length === 1 ? "" : "s"}`}
            </button>
            {expanded && (
              <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3 @lg:grid-cols-4">
                {rest.map((f) => (
                  <RowFieldInput
                    key={f.key}
                    field={f}
                    value={row.values[f.key]}
                    flag={flag(`${base}.values.${f.key}`)}
                    onChange={(v) => set(`${base}.values.${f.key}`, v)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {player && row.match && (
        <PlayerPickerSheet
          open={picking}
          onOpenChange={setPicking}
          printedName={row.name ?? ""}
          match={row.match}
          value={row.playerId}
          onChange={(chosen) => update((d) => choosePlayerAt(d, base, chosen))}
        />
      )}
    </article>
  );
}
