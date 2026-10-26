import { cn } from "@/lib/cn";

export type ComparisonSide = { label: string; color: string };
export type ComparisonRow = {
  id: string;
  label: string;
  left: { text: string; value: number | null };
  right: { text: string; value: number | null };
  better: "higher" | "lower";
};

type StatComparisonProps = {
  left: ComparisonSide;
  right: ComparisonSide;
  rows: readonly ComparisonRow[];
  className?: string;
};

/**
 * Two teams' numbers side by side with a split bar per row (game detail team stats). The side
 * that did better on a row is bold. Works the same at phone width: values hug the edges.
 */
export function StatComparison({ left, right, rows, className }: StatComparisonProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs font-semibold tracking-wide uppercase">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: left.color }} />
          {left.label}
        </span>
        <span className="flex items-center gap-2">
          {right.label}
          <span className="size-2.5 rounded-full" style={{ background: right.color }} />
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const l = row.left.value ?? 0;
          const r = row.right.value ?? 0;
          const total = l + r;
          const share = total > 0 ? (l / total) * 100 : 50;
          const leftWins = row.better === "higher" ? l > r : l < r;
          const rightWins = row.better === "higher" ? r > l : r < l;
          return (
            <li key={row.id} className="px-4 py-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn("num w-16", leftWins ? "font-bold" : "text-muted-foreground")}>
                  {row.left.text}
                </span>
                <span className="truncate text-center text-xs text-muted-foreground">{row.label}</span>
                <span
                  className={cn("num w-16 text-right", rightWins ? "font-bold" : "text-muted-foreground")}
                >
                  {row.right.text}
                </span>
              </div>
              <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                <span className="rounded-l-full" style={{ width: `${share}%`, background: left.color }} />
                <span className="flex-1 rounded-r-full" style={{ background: right.color }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
