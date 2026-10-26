import { CircleAlert, Info, ThumbsUp, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { DraftWarning } from "@shared/ingestion/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { attentionItems, getAt } from "./draftEdit";
import { NumberField } from "./NumberField";
import { useReviewDraft } from "./reviewDraft";

const ICON = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;
const TONE = { error: "text-loss", warning: "text-warn", info: "text-muted-foreground" } as const;

function Note({ warning }: { warning: DraftWarning }) {
  const Icon = ICON[warning.severity];
  return (
    <li className="flex gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[warning.severity])} />
      <span>{warning.message}</span>
    </li>
  );
}

/**
 * "Check first": the doubtful fields in confidence order, editable in place, so a review can
 * be finished with thumbs (FEATURES.md 9). Whole-game notes come first.
 */
export function AttentionList() {
  const { draft, warnings, confidence, set, flag } = useReviewDraft();
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const items = useMemo(
    () => attentionItems(draft, confidence, warnings).filter((i) => !confirmed.has(i.path)),
    [draft, confidence, warnings, confirmed],
  );
  // Per-line notes ("will be added as a new player") are summed up rather than listed.
  const general = warnings.filter((w) => !w.path && w.severity !== "info");
  const newPlayers =
    draft.target === "game_box_score"
      ? draft.lines.filter((l) => l.playerId === null && l.match.status === "new").length
      : 0;
  if (newPlayers > 0) {
    general.push({
      severity: "info",
      message: `${newPlayers} player${newPlayers === 1 ? "" : "s"} will be added as new`,
    });
  }
  if (items.length === 0 && general.length === 0) return null;

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
      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const value = getAt(draft, item.path);
            return (
              <li key={item.path} className="flex items-end gap-2 py-2">
                {typeof value === "number" || (value === undefined && item.path.includes(".stats.")) ? (
                  <NumberField
                    className="flex-1"
                    label={item.label}
                    value={typeof value === "number" ? value : undefined}
                    flag={flag(item.path)}
                    onChange={(v) => set(item.path, v)}
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] text-muted-foreground">{item.label}</div>
                    <div className="text-sm">{item.warning?.message ?? "Low confidence"}</div>
                  </div>
                )}
                {item.warning && typeof value === "number" && (
                  <span
                    className={cn(
                      "mb-2.5 hidden max-w-48 truncate text-xs @md:inline",
                      TONE[item.warning.severity],
                    )}
                  >
                    {item.warning.message}
                  </span>
                )}
                {item.warning?.severity !== "error" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${item.label} looks right`}
                    onClick={() => setConfirmed((c) => new Set(c).add(item.path))}
                  >
                    <ThumbsUp />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
