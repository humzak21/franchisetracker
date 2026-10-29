import {
  eliteTier,
  formatStat,
  gameTier,
  getStat,
  type StatKey,
  type ThresholdOverrides,
} from "@shared/stats";
import { cn } from "@/lib/cn";
import { Highlight } from "./Highlight";

type StatCellProps = {
  stat: StatKey;
  value: number | null | undefined;
  /** Elite highlighting: `true` on the season scale, `"game"` on the single-game scale (box scores, game logs). */
  highlight?: boolean | "game";
  thresholds?: ThresholdOverrides;
  /** Where the number came from when it isn't the usual source: a marker dot with this as its tooltip. */
  note?: string;
  className?: string;
};

/** A registry-formatted, tabular, optionally highlighted number. The only way tables render stats. */
export function StatCell({ stat, value, highlight = false, thresholds, note, className }: StatCellProps) {
  const text = formatStat(stat, value);
  const tier =
    highlight === "game" ? gameTier(stat, value) : highlight ? eliteTier(stat, value, thresholds) : 0;
  const missing = value === null || value === undefined;
  return (
    <span className={cn("num", missing && "text-subtle-foreground", className)}>
      <Highlight
        tier={tier}
        title={
          tier
            ? `${getStat(stat).label}: ${highlight === "game" ? "big game" : "elite"} tier ${tier}`
            : undefined
        }
      >
        {text}
      </Highlight>
      {note && (
        <sup title={note} className="ml-0.5 text-primary">
          •<span className="sr-only"> ({note})</span>
        </sup>
      )}
    </span>
  );
}
