import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { POSITION_GROUP_LABELS, POSITION_GROUPS, type PositionGroup } from "@shared/domain";
import {
  describeQuestion,
  EXPLORER_SCOPE_LABELS,
  EXPLORER_SCOPES,
  formatStat,
  MARK_HORIZON_LABELS,
  MARK_HORIZONS,
  MARKS,
  scopeStats,
  SPAN_WINDOWS,
  SPLIT_CHOICES,
  STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  usesMinGames,
  versusSplit,
  type MarkStat,
  type Question,
  type SpanWindow,
  type StatKey,
} from "@shared/stats";
import { Field } from "@/components/forms/Field";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

type BuilderProps = {
  question: Question;
  onChange: (next: Question) => void;
  /** Seasons a range can start or end on, oldest first. */
  years: readonly number[];
  /** Teams to split by, as abbreviations. */
  opponents: readonly string[];
  /** Picks one player; the screen owns the search. */
  player: ReactNode;
};

/** Registry order runs raw stats before rates, so categories are put back together. */
const statOptions = (keys: readonly StatKey[]) =>
  [...keys]
    .sort(
      (a, b) =>
        STAT_CATEGORIES.indexOf(STAT_REGISTRY[a].category) -
        STAT_CATEGORIES.indexOf(STAT_REGISTRY[b].category),
    )
    .map((key) => ({
      value: key,
      label: STAT_REGISTRY[key].label,
      group: STAT_CATEGORY_LABELS[STAT_REGISTRY[key].category],
    }));

function Controls({ question: q, onChange, years, opponents, player }: BuilderProps) {
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  const yearOptions = (all: string) => [
    { value: "", label: all },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];
  const year = (value: string) => (value === "" ? null : Number(value));
  const marks: readonly number[] = q.scope === "mark" ? MARKS[q.statKey as MarkStat] : [];
  return (
    <div className="@container space-y-3">
      <Segmented
        aria-label="Scope"
        value={q.scope}
        onChange={(scope) => set({ scope })}
        options={EXPLORER_SCOPES.map((s) => ({ value: s, label: EXPLORER_SCOPE_LABELS[s] }))}
        className="max-w-full scrollbar-none overflow-x-auto"
      />
      <div className="grid gap-3 @tablet:grid-cols-2 @desktop:grid-cols-4">
        <Field label="Stat">
          <Select
            aria-label="Stat"
            value={q.statKey}
            options={statOptions(scopeStats(q.scope))}
            onValueChange={(value) => set({ statKey: value as StatKey })}
          />
        </Field>
        <Field label="Split">
          <Select
            aria-label="Split"
            value={q.split}
            options={[
              ...SPLIT_CHOICES,
              ...opponents.map((abbr) => ({
                value: versusSplit(abbr),
                label: `vs ${abbr}`,
                group: "By team",
              })),
            ]}
            onValueChange={(split) => set({ split })}
          />
        </Field>
        {q.scope === "span" && (
          <Field label="Games in a row">
            <Select
              aria-label="Games in a row"
              value={String(q.window)}
              options={SPAN_WINDOWS.map((w) => ({ value: String(w), label: `${w} games` }))}
              onValueChange={(value) => set({ window: Number(value) as SpanWindow })}
            />
          </Field>
        )}
        {q.scope === "mark" && (
          <Field label="Mark">
            <Select
              aria-label="Mark"
              value={String(q.mark)}
              options={marks.map((m) => ({ value: String(m), label: formatStat(q.statKey, m) }))}
              onValueChange={(value) => set({ mark: Number(value) })}
            />
          </Field>
        )}
        {q.scope === "mark" && (
          <Field label="Counted over">
            <Select
              aria-label="Counted over"
              value={q.horizon}
              options={MARK_HORIZONS.map((h) => ({ value: h, label: MARK_HORIZON_LABELS[h] }))}
              onValueChange={(value) => set({ horizon: value as Question["horizon"] })}
            />
          </Field>
        )}
        <Field label="Position">
          <Select
            aria-label="Position"
            value={q.position ?? ""}
            options={[
              { value: "", label: "All positions" },
              ...POSITION_GROUPS.map((p) => ({ value: p, label: POSITION_GROUP_LABELS[p] })),
            ]}
            onValueChange={(value) => set({ position: value === "" ? null : (value as PositionGroup) })}
          />
        </Field>
        <Field label="From">
          <Select
            aria-label="From"
            value={q.fromYear === null ? "" : String(q.fromYear)}
            options={yearOptions("First season")}
            onValueChange={(value) => set({ fromYear: year(value) })}
          />
        </Field>
        <Field label="To">
          <Select
            aria-label="To"
            value={q.toYear === null ? "" : String(q.toYear)}
            options={yearOptions("Latest season")}
            onValueChange={(value) => set({ toYear: year(value) })}
          />
        </Field>
        {usesMinGames(q.scope) && (
          <Field label="At least this many games">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label="At least this many games"
              value={q.minGames === 0 ? "" : q.minGames}
              onChange={(e) => set({ minGames: Number(e.target.value) })}
            />
          </Field>
        )}
      </div>
      {player}
    </div>
  );
}

/**
 * The explorer's controls: scope, stat, split, the scope's own window or mark, position, seasons
 * and minimum games. On a phone they open in a sheet behind a line saying what is being asked.
 */
export function QuestionBuilder(props: BuilderProps) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  return (
    <div ref={ref}>
      {compact ? (
        <>
          <Button
            variant="outline"
            className="h-auto min-h-11 w-full justify-start py-2 text-left whitespace-normal"
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal />
            <span className="min-w-0 flex-1">{describeQuestion(props.question)}</span>
          </Button>
          <BottomSheet
            open={open}
            onOpenChange={setOpen}
            title="Build a question"
            textEntry
            footer={
              <Button variant="primary" className="w-full" onClick={() => setOpen(false)}>
                Done
              </Button>
            }
          >
            <Controls {...props} />
          </BottomSheet>
        </>
      ) : (
        <Controls {...props} />
      )}
    </div>
  );
}
