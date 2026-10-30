import { ChevronRight, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { POSITIONS, type Position } from "@shared/domain";
import {
  RAW_STAT_KEYS,
  RAW_STATS,
  RAW_STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  type RawStatKey,
} from "@shared/stats";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { needsDecision } from "@shared/ingestion/validate";
import { choosePlayerAt } from "./draftEdit";
import { NumberField } from "./NumberField";
import { PlayerPickerSheet } from "./PlayerPickerSheet";
import { useReviewDraft, type ReviewDraft } from "./reviewDraft";

type Line = Extract<ReviewDraft, { target: "game_box_score" | "game_log" }>["lines"][number];

const statLabel = (key: RawStatKey) =>
  `${STAT_CATEGORY_LABELS[RAW_STATS[key].category].slice(0, 4)} ${RAW_STATS[key].abbr}`;

/** One player's line: who it is, their team and position, and every stat the screens showed. */
export function LineEditor({ line, teams }: { line: Line; teams: readonly string[] }) {
  const { set, update, flag } = useReviewDraft();
  const [picking, setPicking] = useState(false);
  const base = `lines.${line.id}`;
  const chosen = line.match.candidates.find((c) => c.playerId === line.playerId);
  const present = RAW_STAT_KEYS.filter((k) => line.stats[k] !== undefined);
  const missing = RAW_STAT_KEYS.filter((k) => line.stats[k] === undefined);
  const nameFlag = flag(`${base}.name`);

  return (
    <article
      className={cn(
        "rounded-xl border bg-surface",
        flag(`${base}.teamAbbr`) === "error" ? "border-loss" : "border-border",
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={cn(
            "-m-1 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left hover:bg-surface-2",
            nameFlag && "bg-warn/10",
          )}
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{line.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {chosen ? (
                <>→ {chosen.name}</>
              ) : line.playerId ? (
                "→ Chosen player"
              ) : needsDecision(line) ? (
                <span className="text-warn">
                  {line.match.status === "ambiguous"
                    ? "Choose who this is"
                    : "Pick a player or create as new"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <UserPlus className="size-3" /> New player
                </span>
              )}
            </span>
          </span>
          <ChevronRight className="ml-auto size-4 shrink-0 text-subtle-foreground" />
        </button>
        {needsDecision(line) && (
          <Button
            size="sm"
            variant="outline"
            aria-label={`Create ${line.name} as new`}
            onClick={() => update((d) => choosePlayerAt(d, base, { kind: "new", name: line.name }))}
          >
            <UserPlus /> Create as new
          </Button>
        )}
        <Segmented
          size="sm"
          aria-label={`${line.name} team`}
          value={line.teamAbbr ?? ""}
          onChange={(abbr) => set(`${base}.teamAbbr`, abbr)}
          options={teams.map((abbr) => ({ value: abbr, label: abbr }))}
        />
        <Select
          className="w-24"
          aria-label={`${line.name} position`}
          value={line.position ?? ""}
          placeholder="Pos"
          onValueChange={(p) => set(`${base}.position`, p as Position)}
          options={POSITIONS.map((p) => ({ value: p, label: p }))}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${line.name}`}
          onClick={() =>
            update((d) => ("lines" in d ? { ...d, lines: d.lines.filter((l) => l.id !== line.id) } : d))
          }
        >
          <Trash2 />
        </Button>
      </header>
      <div className="space-y-3 p-3">
        {RAW_STAT_CATEGORIES.map((category) => {
          const keys = present.filter((k) => RAW_STATS[k].category === category);
          if (keys.length === 0) return null;
          return (
            <section key={category}>
              <Badge className="mb-1.5">{STAT_CATEGORY_LABELS[category]}</Badge>
              <div className="grid grid-cols-3 gap-2 @md:grid-cols-5 @2xl:grid-cols-7">
                {keys.map((key) => (
                  <NumberField
                    key={key}
                    label={RAW_STATS[key].label}
                    value={line.stats[key]}
                    flag={flag(`${base}.stats.${key}`)}
                    onChange={(v) => set(`${base}.stats.${key}`, v)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        <Select
          aria-label={`Add a stat for ${line.name}`}
          value=""
          placeholder="Add a stat…"
          onValueChange={(key) => set(`${base}.stats.${key}`, 0)}
          options={missing.map((k) => ({ value: k, label: `${statLabel(k)} · ${RAW_STATS[k].label}` }))}
        />
      </div>
      <PlayerPickerSheet
        open={picking}
        onOpenChange={setPicking}
        base={base}
        printedName={line.name}
        match={line.match}
        value={line.playerId}
        onChange={(player) => update((d) => choosePlayerAt(d, base, player))}
      />
    </article>
  );
}
