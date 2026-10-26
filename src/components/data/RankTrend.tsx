import { ArrowDown, ArrowUp } from "lucide-react";
import { rankChange } from "@shared/stats/teamTrends";
import { cn } from "@/lib/cn";
import { RankBadge } from "./RankBadge";
import { RankRibbon } from "./RankRibbon";

export type RankTrendPoint = { year: number; value: string; rank: number | null; tied: boolean };

export type RankTrendRow = {
  key: string;
  label: string;
  /** Seasons ascending. */
  points: readonly RankTrendPoint[];
};

function Change({ points, year }: { points: readonly RankTrendPoint[]; year: number }) {
  const change = rankChange(points, year);
  if (!change) return null;
  if (change.climb === 0)
    return <span className="text-xs text-subtle-foreground">Same as {change.from}</span>;
  const Icon = change.climb > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-xs",
        change.climb > 0 ? "text-win" : "text-loss",
      )}
    >
      <Icon className="size-3" />
      {Math.abs(change.climb)} from {change.from}
    </span>
  );
}

/**
 * Team rank ribbons across seasons: the chosen season's ribbon per stat, its move from the season
 * before, and every season's rank as a strip of badges. The strip scrolls within its row, so the
 * phone keeps every season without the page scrolling sideways.
 */
export function RankTrend({ rows, year }: { rows: readonly RankTrendRow[]; year: number }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const current = row.points.find((p) => p.year === year);
        return (
          <li key={row.key} className="space-y-2 py-3 first:pt-0 last:pb-0">
            {current?.rank != null ? (
              <RankRibbon label={row.label} value={current.value} rank={current.rank} tied={current.tied} />
            ) : (
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="font-medium text-muted-foreground">{row.label}</span>
                <span className="num text-sm font-semibold">{current?.value ?? "—"}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <ol
                aria-label={`${row.label} rank by season`}
                className="flex min-w-0 flex-1 scrollbar-none gap-1.5 overflow-x-auto"
              >
                {row.points.map((p) => (
                  <li
                    key={p.year}
                    className={cn(
                      "flex shrink-0 flex-col items-center gap-0.5 rounded-md px-1 py-0.5",
                      p.year === year && "bg-surface-2 ring-1 ring-border-strong",
                    )}
                  >
                    <span className="num text-[10px] text-subtle-foreground">{p.year}</span>
                    {p.rank !== null ? (
                      <RankBadge rank={p.rank} tied={p.tied} />
                    ) : (
                      <span className="num h-5 text-[11px] text-subtle-foreground">{p.value}</span>
                    )}
                  </li>
                ))}
              </ol>
              <Change points={row.points} year={year} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
