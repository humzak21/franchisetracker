import { CircleAlert, Info, TriangleAlert, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { isRowDraft, rowTarget } from "@shared/ingestion/targets";
import type { DraftWarning, PlayerMatch } from "@shared/ingestion/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { attentionItems, choosePlayerAt, confirmNewLines, getAt, undecidedNewLines } from "./draftEdit";
import { NumberField } from "./NumberField";
import { PlayerPickerSheet } from "./PlayerPickerSheet";
import { useReviewDraft } from "./reviewDraft";

const ICON = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;
const TONE = { error: "text-loss", warning: "text-warn", info: "text-muted-foreground" } as const;
const NO_CANDIDATES: PlayerMatch<Id<"players">> = { status: "new", candidates: [] };

function Note({ warning }: { warning: DraftWarning }) {
  const Icon = ICON[warning.severity];
  return (
    <li className="flex gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[warning.severity])} />
      <span>{warning.message}</span>
    </li>
  );
}

/** Doubtful fields and actionable suggestions, editable without leaving the checklist. */
export function AttentionList() {
  const { draft, warnings, confidence, set, update, flag, matchOf } = useReviewDraft();
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState<string | null>(null);
  const items = useMemo(
    () => attentionItems(draft, confidence, warnings).filter((i) => !confirmed.has(i.path)),
    [draft, confidence, warnings, confirmed],
  );
  const confirm = (path: string) => setConfirmed((c) => new Set(c).add(path));
  const general = warnings.filter((w) => !w.path && w.severity !== "info");
  const undecided = undecidedNewLines(draft).length;
  const newPlayers =
    "lines" in draft
      ? draft.lines.filter((l) => l.playerId === null && l.confirmedNew).length
      : isRowDraft(draft) && !rowTarget(draft.target).spec.optionalPlayer
        ? draft.rows.filter((r) => r.accepted && r.playerId === null && r.match?.status === "new").length
        : 0;
  if (newPlayers > 0)
    general.push({
      severity: "info",
      message: `${newPlayers} player${newPlayers === 1 ? "" : "s"} will be added as new`,
    });
  const noNewPlayers = (base: string) =>
    base.startsWith("plays.") || (isRowDraft(draft) && rowTarget(draft.target).spec.optionalPlayer);
  const createAsNew = (base: string) => {
    update((d) => choosePlayerAt(d, base, { kind: "new", name: String(getAt(d, `${base}.name`)) }));
    confirm(`${base}.name`);
  };
  const pickedMatch = picking ? (matchOf(picking) ?? (noNewPlayers(picking) ? NO_CANDIDATES : null)) : null;
  if (items.length === 0 && general.length === 0 && !picking) return null;

  return (
    <section className="space-y-3 rounded-xl border border-warn/40 bg-warn/5 p-3" aria-label="Check first">
      <h3 className="font-display text-base font-semibold tracking-wide uppercase">Check first</h3>
      {general.length > 0 && (
        <ul className="space-y-1.5">
          {general.map((w, i) => (
            <Note key={`${w.message}-${i}`} warning={w} />
          ))}
        </ul>
      )}
      {undecided > 1 && (
        <Button
          size="sm"
          variant="outline"
          aria-label={`Create all ${undecided} as new players`}
          onClick={() => update(confirmNewLines)}
        >
          <UserPlus /> Create all {undecided} as new
        </Button>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const value = getAt(draft, item.path);
            const base = item.path.replace(/\.name$/, "");
            const match = item.path.endsWith(".name")
              ? (matchOf(base) ?? (noNewPlayers(base) ? NO_CANDIDATES : null))
              : null;
            const playerId = match ? getAt(draft, `${base}.playerId`) : null;
            const candidate = !playerId && match?.status === "ambiguous" ? match.candidates[0] : null;
            const suggested = item.warning?.suggestedValue;
            const numeric =
              typeof value === "number" || (value === undefined && item.path.includes(".stats."));
            return (
              <li key={item.path} className="space-y-1.5 py-2">
                <div className="flex flex-wrap items-end gap-2">
                  {numeric ? (
                    <NumberField
                      className="min-w-32 flex-1"
                      label={item.label}
                      value={typeof value === "number" ? value : undefined}
                      flag={flag(item.path)}
                      readOnly={item.path.startsWith("teams.") && item.path.endsWith(".totalYds")}
                      onChange={(v) => set(item.path, v)}
                    />
                  ) : (
                    <div className="min-w-32 flex-1">
                      <div className="text-[11px] text-muted-foreground">{item.label}</div>
                      <div className="text-sm">{item.warning?.message ?? "Low confidence"}</div>
                    </div>
                  )}
                  {suggested !== undefined && (
                    <Button
                      size="sm"
                      variant="primary"
                      aria-label={`Apply ${suggested} for ${item.label}`}
                      onClick={() => {
                        set(item.path, suggested);
                        confirm(item.path);
                      }}
                    >
                      Apply {suggested}
                    </Button>
                  )}
                  {candidate && (
                    <Button
                      size="sm"
                      variant="primary"
                      aria-label={`Assign ${candidate.name} for ${item.label}`}
                      onClick={() => {
                        update((d) =>
                          choosePlayerAt(d, base, {
                            kind: "player",
                            _id: candidate.playerId,
                            name: candidate.name,
                          }),
                        );
                        confirm(item.path);
                      }}
                    >
                      Assign {candidate.name}
                    </Button>
                  )}
                  {match && (
                    <Button size="sm" variant="outline" onClick={() => setPicking(base)}>
                      {playerId || candidate ? "Change player" : "Choose player"}
                    </Button>
                  )}
                  {match && item.warning?.severity === "error" && !noNewPlayers(base) && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Create ${item.label} as new`}
                      onClick={() => createAsNew(base)}
                    >
                      Create as new
                    </Button>
                  )}
                  {item.warning?.severity !== "error" && !candidate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Approve ${item.label}`}
                      onClick={() => confirm(item.path)}
                    >
                      Approve
                    </Button>
                  )}
                </div>
                {numeric && item.warning && (
                  <p className={cn("text-xs", TONE[item.warning.severity])}>{item.warning.message}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {picking && pickedMatch && (
        <PlayerPickerSheet
          open
          onOpenChange={(open) => {
            if (!open) setPicking(null);
          }}
          base={picking}
          printedName={String(getAt(draft, `${picking}.name`) ?? "Which player?")}
          match={pickedMatch}
          value={getAt(draft, `${picking}.playerId`) as Id<"players"> | null}
          prospects={isRowDraft(draft) && rowTarget(draft.target).spec.newPlayers}
          noNewPlayers={noNewPlayers(picking)}
          onChange={(player) => {
            update((d) => choosePlayerAt(d, picking, player));
            confirm(`${picking}.name`);
          }}
        />
      )}
    </section>
  );
}
