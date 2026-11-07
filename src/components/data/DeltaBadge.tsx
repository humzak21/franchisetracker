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
  const shown = format(Math.abs(delta));
  // A change too small to print (0.04 at one decimal) reads as no change, not as "−0.0".
  const flat = shown === format(0);
  const good = better === "higher" ? delta > 0 : delta < 0;
  const tone = flat || muted ? "text-muted-foreground" : good ? "text-win" : "text-loss";
  return (
    <span className={cn("num text-xs font-semibold whitespace-nowrap", tone, className)}>
      {flat ? "" : delta > 0 ? "+" : "−"}
      {shown}
    </span>
  );
}
