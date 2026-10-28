import { Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { trendRows } from "@shared/stats/teamTrends";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { RankTrend } from "@/components/data/RankTrend";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { sourceNote } from "./teamSourceNote";

/**
 * Team stats (FEATURES.md 5.5): the season's value in every team stat, derived from the games'
 * team stats unless the season screen was captured, as rank ribbons where a league rank is known,
 * with each stat in every other season beside it.
 */
export function TeamRanks() {
  const { season } = useSeason();
  const trends = useQuery(api.league.teamStats.trends, {});
  if (trends === undefined || !season) return <Skeleton className="h-96 rounded-xl" />;
  const rows = trendRows(trends);
  if (!rows.some((r) => r.points.some((p) => p.year === season.year))) {
    return (
      <EmptyState
        icon={BarChart3}
        title={`No team stats for ${season.year}`}
        description="Import each game's team stats and the season figures add up here; capture the season team stats screen for league ranks."
        action={
          <Button asChild variant="primary" size="sm">
            <Link to="/inbox">Capture team stats</Link>
          </Button>
        }
      />
    );
  }
  const note = sourceNote(trends, season.year, season.teamTotals?.games ?? 0);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4 @tablet:p-5">
      <RankTrend rows={rows} year={season.year} />
      {note && <p className="border-t border-border pt-3 text-xs text-subtle-foreground">{note}</p>}
    </div>
  );
}
