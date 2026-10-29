import { Check } from "lucide-react";
import { REGULAR_WEEKS, weekLabel, type WeekKey } from "@shared/domain";
import { cn } from "@/lib/cn";
import type { WeekState } from "./batch";

const TONE: Record<WeekState, string> = {
  done: "border-transparent bg-win/15 text-win",
  assigned: "border-primary/60 bg-elite-1 text-foreground",
  duplicate: "border-warn bg-warn/15 text-warn",
  missing: "border-dashed border-border-strong text-subtle-foreground",
};
const LABEL: Record<WeekState, string> = {
  done: "awards stored",
  assigned: "screenshot matched",
  duplicate: "two screenshots",
  missing: "nothing yet",
};

/** The regular season at a glance: which weeks have awards, which have a screenshot waiting, which have nothing. */
export function WeekStrip({ states }: { states: Record<WeekKey, WeekState> }) {
  return (
    <ol aria-label="Weeks" className="grid grid-cols-6 gap-1.5 @tablet:grid-cols-9 @desktop:grid-cols-18">
      {REGULAR_WEEKS.map((week) => (
        <li
          key={week}
          title={`${weekLabel(week, "long")}: ${LABEL[states[week]]}`}
          aria-label={`${weekLabel(week, "long")}: ${LABEL[states[week]]}`}
          className={cn(
            "num flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold",
            TONE[states[week]],
          )}
        >
          {states[week] === "done" && <Check className="size-3" />}
          {weekLabel(week)}
        </li>
      ))}
    </ol>
  );
}
