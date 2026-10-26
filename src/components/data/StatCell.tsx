import { eliteTier, formatStat, getStat, type StatKey, type ThresholdOverrides } from "@shared/stats";
import { cn } from "@/lib/cn";
import { Highlight } from "./Highlight";

type StatCellProps = {
  stat: StatKey;
  value: number | null | undefined;
  /** Season-level elite highlighting. Off for per-game cells, which use game thresholds instead. */
  highlight?: boolean;
  thresholds?: ThresholdOverrides;
  className?: string;
};

/** A registry-formatted, tabular, optionally highlighted number. The only way tables render stats. */
export function StatCell({ stat, value, highlight = false, thresholds, className }: StatCellProps) {
  const text = formatStat(stat, value);
  const tier = highlight ? eliteTier(stat, value, thresholds) : 0;
  const missing = value === null || value === undefined;
  return (
    <span className={cn("num", missing && "text-subtle-foreground", className)}>
      <Highlight tier={tier} title={tier ? `${getStat(stat).label}: elite tier ${tier}` : undefined}>
        {text}
      </Highlight>
    </span>
  );
}
