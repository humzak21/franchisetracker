import { CLINCH_LABELS } from "@shared/league/projection";
import { formatRecord } from "@shared/stats";
import { cn } from "@/lib/cn";
import { TeamLink } from "./TeamLink";
import type { BoardRow } from "./types";

/** Bye seeds read green, wild cards orange, everyone else plain. */
export function seedTint(seed: number | null, byeSeeds: number) {
  if (seed === null) return "border-l-transparent";
  return seed <= byeSeeds ? "border-l-win bg-win/10" : "border-l-warn bg-warn/10";
}

/**
 * One team's line in a standings list: its place, the team with its clinch mark (z bye, y
 * division, x playoff spot), its seed and record. Tinted by the seed it holds or projects to.
 */
export function StandingRow({
  row,
  place,
  byeSeeds,
  detail,
}: {
  row: BoardRow;
  place: number;
  byeSeeds: number;
  detail?: string;
}) {
  return (
    <li
      className={cn(
        "flex min-h-11 items-center gap-2 border-b border-l-[3px] border-b-border px-3 py-1.5 last:border-b-0",
        seedTint(row.seed, byeSeeds),
      )}
    >
      <span className="num w-5 shrink-0 text-xs text-subtle-foreground">{place}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {row.clinch && (
          <abbr
            title={CLINCH_LABELS[row.clinch]}
            className="w-3 shrink-0 text-xs font-bold text-muted-foreground no-underline"
          >
            {row.clinch}
          </abbr>
        )}
        <TeamLink team={row.team} label="name" size="xs" className="min-w-0" />
        {detail && <span className="shrink-0 text-xs text-subtle-foreground">{detail}</span>}
      </span>
      {row.seed !== null && (
        <span
          className="num w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground"
          title={`Seed ${row.seed}`}
        >
          {row.seed}
        </span>
      )}
      <span className="num w-14 shrink-0 text-right text-sm font-semibold">{formatRecord(row)}</span>
    </li>
  );
}
