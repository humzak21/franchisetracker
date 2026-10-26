import { Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { PULSE_STATS, trendRows } from "@shared/stats/teamTrends";
import { EmptyState } from "@/components/data/EmptyState";
import { RankTrend } from "@/components/data/RankTrend";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

/** The team's league rank in key categories this season, and how each moved since the last. */
export function RankPulse({ year }: { year: number }) {
  const trends = useQuery(api.league.teamStats.trends, {});
  if (trends === undefined) return <Skeleton className="h-48 rounded-xl" />;
  const rows = trendRows(trends, PULSE_STATS).filter((r) => r.points.some((p) => p.year === year));
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No team ranks yet"
        description="Capture the team stats screen to rank the team across the league."
      />
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <RankTrend rows={rows} year={year} />
      <Link to="/stats" className="block text-sm font-medium text-primary hover:underline">
        Every team stat in Stats → Team
      </Link>
    </div>
  );
}
