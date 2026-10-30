import { cn } from "@/lib/cn";

type DeltaBadgeProps = {
  delta: number | null;
  /** Which direction is good, from the stat's registry entry. */
  better?: "higher" | "lower";
  /** Formats the size of the change; the sign is added here. */
  format?: (value: number) => string;
  /** A season too short to trust: the change shows without a verdict. */
  muted?: boolean;
  className?: string;
};

/** A signed change, coloured by whether it is good: year over year in tables and tiles. */
export function DeltaBadge({ delta, better = "higher", format = String, muted, className }: DeltaBadgeProps) {
  if (delta === null) return <span className="text-subtle-foreground">—</span>;
  const good = better === "higher" ? delta > 0 : delta < 0;
  const tone = delta === 0 || muted ? "text-muted-foreground" : good ? "text-win" : "text-loss";
  return (
    <span className={cn("num text-xs font-semibold whitespace-nowrap", tone, className)}>
      {delta > 0 ? "+" : delta < 0 ? "−" : ""}
      {format(Math.abs(delta))}
    </span>
  );
}
