import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BarChart3 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { trendRows } from "@shared/stats/teamTrends";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { RankTrend } from "@/components/data/RankTrend";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";

/**
 * Team stats (FEATURES.md 5.5): the season's league rank in every team stat as rank ribbons,
 * with each stat's rank in every other captured season beside it.
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
        description="Capture the team stats screen; each stat's value and league rank lands here and on Home."
        action={
          <Button asChild variant="primary" size="sm">
            <Link to="/inbox">Capture team stats</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4 @tablet:p-5">
      <RankTrend rows={rows} year={season.year} />
    </div>
  );
}
