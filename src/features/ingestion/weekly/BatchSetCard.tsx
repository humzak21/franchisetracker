import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Check, ImageOff, LoaderCircle, Trash2 } from "lucide-react";
import type { api } from "@convex/_generated/api";
import { REGULAR_WEEKS, weekLabel, type WeekKey } from "@shared/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import type { WeekState } from "./batch";

export type BatchSet = FunctionReturnType<typeof api.ingestion.weeklyAwards.batch>[number];

const NOTE: Partial<Record<WeekState, string>> = { done: " · has awards", assigned: " · taken" };

/** What the set is waiting on, in a word or two. */
function statusOf(set: BatchSet) {
  if (set.status === "committed") return { label: "Committed", tone: "win" as const };
  if (set.status === "extracting") return { label: "Reading", tone: "accent" as const };
  if (set.status === "failed") return { label: "Failed", tone: "loss" as const };
  if (set.status === "review") {
    return set.ready
      ? { label: `${set.winners ?? 0} winners · ready`, tone: "win" as const }
      : { label: "Needs review", tone: "warn" as const };
  }
  return set.weekKey
    ? { label: "Ready to read", tone: "solid" as const }
    : { label: "Pick its week", tone: "warn" as const };
}

/** One screenshot of the batch: the image, the week it fills, where it stands, and what to do next. */
export function BatchSetCard({
  set,
  states,
  onWeek,
  onOpen,
  onRemove,
}: {
  set: BatchSet;
  /** Every week's state, to mark the weeks other screenshots or stored awards already fill. */
  states: Record<WeekKey, WeekState>;
  onWeek: (week: WeekKey | undefined) => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const status = statusOf(set);
  const locked = set.status === "committed" || set.status === "extracting";
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View screenshot${set.weekKey ? ` for ${weekLabel(set.weekKey, "long")}` : ""}`}
        className="relative block aspect-video w-full overflow-hidden bg-surface-2"
      >
        {set.imageUrl ? (
          <img src={set.imageUrl} alt="" loading="lazy" className="size-full object-cover object-top" />
        ) : (
          <ImageOff className="absolute inset-0 m-auto size-6 text-subtle-foreground" />
        )}
        <Badge tone={status.tone} className="absolute top-2 left-2 gap-1">
          {set.status === "extracting" && (
            <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />
          )}
          {set.status === "committed" && <Check className="size-3" />}
          {status.label}
        </Badge>
      </button>
      <div className="flex items-center gap-2 p-2">
        <Select
          aria-label="Week"
          className="flex-1"
          value={set.weekKey ?? ""}
          disabled={locked}
          placeholder="Which week?"
          onValueChange={(w) => onWeek(w ? (w as WeekKey) : undefined)}
          options={REGULAR_WEEKS.map((w) => ({
            value: w,
            label: `${weekLabel(w, "long")}${w === set.weekKey ? "" : (NOTE[states[w]] ?? "")}`,
          }))}
        />
        {set.status === "review" && !set.ready && (
          <Button asChild size="sm" variant="primary">
            <Link to="/inbox/$setKey" params={{ setKey: set.setKey }}>
              Review
            </Link>
          </Button>
        )}
        {set.status !== "committed" && (
          <Button size="icon-sm" variant="ghost" aria-label="Remove screenshot" onClick={onRemove}>
            <Trash2 />
          </Button>
        )}
      </div>
      {set.error && set.status === "failed" && <p className="px-2 pb-2 text-xs text-loss">{set.error}</p>}
    </article>
  );
}
