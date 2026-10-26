import { Link } from "@tanstack/react-router";
import { totalsOf, trophiesFor } from "@shared/history/trophies";
import { franchiseSeasons } from "@shared/seasons/reports";
import { formatRecord } from "@shared/stats";
import type { ActiveFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { Tile, TileStrip } from "@/components/data/Tile";
import { cn } from "@/lib/cn";

/**
 * The decade grid teaser (FEATURES.md 5.1): the franchise's record so far and a chip per season,
 * colored by how it ended. Choosing a season switches Home to it; the full grid is in History.
 */
export function FranchiseRecord({ active }: { active: ActiveFranchise }) {
  const { season, setYear } = useSeason();
  const own = franchiseSeasons(active.seasons, active.franchise.startYear);
  const totals = totalsOf(own);
  const divisions = own.filter((s) => trophiesFor(s).includes("division")).length;

  return (
    <div className="space-y-3">
      <TileStrip>
        <Tile label="All-time" value={formatRecord(totals)} accent detail={`${own.length} seasons`} />
        <Tile label="Playoffs" value={totals.playoffs} detail="Appearances" />
        <Tile label="Division titles" value={divisions} />
        <Tile
          label="Super Bowls"
          value={totals.titles}
          detail={totals.titles > 0 ? "Won" : "Still chasing"}
        />
      </TileStrip>
      <ul className="flex flex-wrap gap-2">
        {own.map((s) => {
          const trophies = trophiesFor(s);
          return (
            <li key={s._id}>
              <button
                type="button"
                onClick={() => setYear(s.year)}
                aria-pressed={s.year === season?.year}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg border bg-surface px-3 text-sm transition-colors hover:bg-surface-2",
                  s.year === season?.year ? "border-primary ring-1 ring-primary" : "border-border",
                  trophies.includes("superBowl") && "bg-elite-2/20",
                )}
              >
                <span className="num font-display text-lg font-bold">{s.year}</span>
                <span className="num text-muted-foreground">
                  {s.userRecord ? formatRecord(s.userRecord) : "—"}
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <Link
            to="/history"
            className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:bg-surface-2"
          >
            Decade grid
          </Link>
        </li>
      </ul>
    </div>
  );
}
