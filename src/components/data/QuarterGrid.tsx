import { periodLabel } from "@shared/games/lineScore";
import { formatSigned } from "@shared/stats";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type QuarterCell = {
  period: number;
  pointsFor: number;
  pointsAgainst: number;
  differential: number;
};

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
      <span
        className={cn("block h-full rounded-full", className)}
        style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }}
      />
    </span>
  );
}

/** Points for, against and the difference per period, a bar in each cell; overtime adds columns. */
export function QuarterGrid({ periods }: { periods: readonly QuarterCell[] }) {
  const max = Math.max(0, ...periods.flatMap((p) => [p.pointsFor, p.pointsAgainst]));
  const row = (label: string, cell: (p: QuarterCell) => ReactNode) => (
    <tr className="border-t border-border">
      <th scope="row" className="py-2 pr-2 text-left text-xs font-medium text-muted-foreground">
        {label}
      </th>
      {periods.map((p) => (
        <td key={p.period} className="num px-1 py-2 text-right text-sm">
          {cell(p)}
        </td>
      ))}
    </tr>
  );
  return (
    <table className="w-full table-fixed">
      <colgroup>
        <col className="w-16" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className="sr-only">
            Points
          </th>
          {periods.map((p) => (
            <th key={p.period} scope="col" className="px-1 pb-2 text-right text-xs font-medium">
              {periodLabel(p.period - 1).replace(/^(\d)$/, "Q$1")}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {row("Scored", (p) => (
          <>
            {p.pointsFor}
            <Bar value={p.pointsFor} max={max} className="bg-primary" />
          </>
        ))}
        {row("Allowed", (p) => (
          <>
            {p.pointsAgainst}
            <Bar value={p.pointsAgainst} max={max} className="bg-muted-foreground" />
          </>
        ))}
        {row("Diff", (p) => (
          <span className={cn(p.differential > 0 && "text-win", p.differential < 0 && "text-loss")}>
            {formatSigned(p.differential)}
          </span>
        ))}
      </tbody>
    </table>
  );
}
