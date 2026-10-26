import { cn } from "@/lib/cn";
import { LEAGUE_SIZE, RankBadge, rankTone, type RankTone } from "./RankBadge";

const barClass: Record<RankTone, string> = {
  top: "bg-primary",
  good: "bg-win",
  mid: "bg-subtle-foreground/60",
  poor: "bg-loss/70",
  bottom: "bg-loss",
};

type RankRibbonProps = {
  label: string;
  /** Formatted value, e.g. "27.3" or "52%". */
  value: string;
  rank: number;
  tied?: boolean;
  of?: number;
  detail?: string;
  className?: string;
};

/** A team stat as a horizontal bar whose length is league standing. Replaces "27.3 - T-3rd" strings. */
export function RankRibbon({
  label,
  value,
  rank,
  tied,
  of = LEAGUE_SIZE,
  detail,
  className,
}: RankRibbonProps) {
  const fill = ((of - rank + 1) / of) * 100;
  return (
    <div className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5", className)}>
      <div className="min-w-0">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {detail && <span className="ml-2 text-xs text-subtle-foreground">{detail}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="num text-sm font-semibold">{value}</span>
        <RankBadge rank={rank} tied={tied} of={of} />
      </div>
      <div
        className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuemin={1}
        aria-valuemax={of}
        aria-valuenow={rank}
        aria-label={`${label} rank`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", barClass[rankTone(rank, of)])}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  );
}
