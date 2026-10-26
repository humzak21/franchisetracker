import { Activity } from "lucide-react";
import { pointsWeeks } from "@shared/games/charts";
import { EmptyState } from "@/components/data/EmptyState";
import { PointsChart } from "@/components/data/PointsChart";
import type { HomeSeason } from "./types";

/** Points for and against by week (FEATURES.md 5.1), each week's opponent in its tooltip. */
export function PointsPulse({ pulse }: { pulse: HomeSeason["pulse"] }) {
  if (pulse.length < 2) {
    return (
      <EmptyState
        icon={Activity}
        title="Not enough games yet"
        description="The week-by-week pulse starts after two results."
      />
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <PointsChart weeks={pointsWeeks(pulse)} />
    </div>
  );
}
