import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FactChipProps = {
  label: ReactNode;
  value: ReactNode;
  /** A second line under the label: "longest 5", "2026", "single game". */
  detail?: ReactNode;
  /** Live and notable (a streak still running, a record held): drawn in the team accent. */
  active?: boolean;
  className?: string;
};

/** A labelled number as a compact chip: streaks, records held, small facts in lists. Wraps on phones. */
export function FactChip({ label, value, detail, active = false, className }: FactChipProps) {
  return (
    <div
      className={cn(
        "inline-flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2",
        active ? "border-primary/40 bg-elite-1" : "border-border bg-surface",
        className,
      )}
    >
      <span className={cn("num font-display text-2xl leading-none font-bold", active && "text-primary")}>
        {value}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
    </div>
  );
}
