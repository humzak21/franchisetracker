import { Plus, X } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { DRAFT_ROUNDS } from "@shared/transactions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { PickDraft } from "./moveForm";

/** Drafts a trade can include: this season's and the next three. */
const YEARS_AHEAD = 4;
const OWN = "own";

/** Keeps an older pick's year choosable when editing a trade. */
const withYear = (options: { value: string; label: string }[], year: number) =>
  options.some((o) => o.value === String(year))
    ? options
    : [{ value: String(year), label: String(year) }, ...options];
const ROUND_OPTIONS = Array.from({ length: DRAFT_ROUNDS }, (_, i) => ({
  value: String(i + 1),
  label: `Rd ${i + 1}`,
}));

/**
 * Draft picks one side sends: year and round, no pick number. A pick is the team's own unless
 * it names the team it originally belonged to.
 */
export function PickList({
  label,
  year,
  teams,
  picks,
  onChange,
}: {
  label: string;
  /** The season the trade belongs to; its draft is the first a pick can come from. */
  year: number;
  teams: readonly { _id: Id<"teams">; abbr: string }[];
  picks: readonly PickDraft[];
  onChange: (picks: PickDraft[]) => void;
}) {
  const years = Array.from({ length: YEARS_AHEAD }, (_, i) => ({
    value: String(year + i),
    label: String(year + i),
  }));
  const origins = [{ value: OWN, label: "Own" }, ...teams.map((t) => ({ value: t._id, label: t.abbr }))];
  const update = (index: number, patch: Partial<PickDraft>) =>
    onChange(picks.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-1.5">
      {picks.map((pick, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-1.5">
          <Select
            aria-label={`${label} ${i + 1}: year`}
            value={String(pick.year)}
            options={withYear(years, pick.year)}
            onValueChange={(y) => update(i, { year: Number(y) })}
          />
          <Select
            aria-label={`${label} ${i + 1}: round`}
            value={String(pick.round)}
            options={ROUND_OPTIONS}
            onValueChange={(r) => update(i, { round: Number(r) })}
          />
          <Select
            aria-label={`${label} ${i + 1}: original team`}
            value={pick.originTeamId ?? OWN}
            options={origins}
            onValueChange={(o) => update(i, { originTeamId: o === OWN ? undefined : (o as Id<"teams">) })}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
            onClick={() => onChange(picks.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange([...picks, { year: year + 1, round: 1 }])}
        aria-label={`Add ${label.toLowerCase()}`}
      >
        <Plus /> Add pick
      </Button>
    </div>
  );
}
