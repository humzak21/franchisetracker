import type { FunctionReturnType } from "convex/server";
import { BarChart3 } from "lucide-react";
import type { api } from "@convex/_generated/api";
import { marginBars, pointsWeeks, streakBars } from "@shared/games/charts";
import { DivergingBars } from "@/components/data/DivergingBars";
import { EmptyState } from "@/components/data/EmptyState";
import { PointsChart } from "@/components/data/PointsChart";
import { Section } from "@/components/layout/Section";

type WeekPoint = FunctionReturnType<typeof api.games.schedule.bySeason>["points"][number];

/** The season as charts (Sprint 8): points by week, margin of victory and the running streak. */
export function ScheduleCharts({ points }: { points: WeekPoint[] }) {
  if (points.length < 2) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Not enough games to chart"
        description="Charts start after two regular-season or playoff results."
      />
    );
  }
  return (
    <div className="grid gap-6 @desktop:grid-cols-2">
      <Section title="Points by week" variant="card" className="@desktop:col-span-2">
        <PointsChart weeks={pointsWeeks(points)} />
      </Section>
      <Section title="Margin of victory" variant="card">
        <DivergingBars points={marginBars(points)} valueLabel="Margin of victory" />
      </Section>
      <Section title="Streak" description="Wins above the line, losses below." variant="card">
        <DivergingBars points={streakBars(points)} valueLabel="Streak" />
      </Section>
    </div>
  );
}
