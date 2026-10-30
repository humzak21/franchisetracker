import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PaceBarProps = {
  label: ReactNode;
  value: number;
  target: number;
  /** Where the current rate finishes, drawn as a ghost past the value. */
  projected?: number | null;
  /** The value and target as text, already formatted. */
  reading: string;
  /** The rate needed, or how many games away. */
  caption?: ReactNode;
  /** A name for screen readers: the label may be a chip. */
  accessibleLabel: string;
  className?: string;
};

const percent = (part: number, whole: number) => Math.min(100, Math.max(0, (part / whole) * 100));

/** Progress to a target, with the projected finish as a ghost segment. Stacks in a narrow pane. */
export function PaceBar({
  label,
  value,
  target,
  projected,
  reading,
  caption,
  accessibleLabel,
  className,
}: PaceBarProps) {
  const done = percent(value, target);
  const ghost = projected === null || projected === undefined ? done : percent(projected, target);
  return (
    <div className={cn("@container min-w-0 space-y-1.5", className)}>
      <div className="flex flex-col gap-x-3 gap-y-0.5 @xs:flex-row @xs:items-baseline @xs:justify-between">
        <div className="min-w-0 truncate text-sm font-medium">{label}</div>
        <div className="num shrink-0 text-xs text-muted-foreground">{reading}</div>
      </div>
      <div
        role="progressbar"
        aria-label={accessibleLabel}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(value, target)}
        className="relative h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="absolute inset-y-0 left-0 bg-primary/30" style={{ width: `${ghost}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${done}%` }} />
      </div>
      {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
    </div>
  );
}
