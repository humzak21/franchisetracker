import { Link } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { GoalLine } from "@/components/data/GoalLine";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

/**
 * The season's pre-season goals on Home (FEATURES.md 5.1, 5.11): how each stands, goals hit in
 * the win color, and the way to the report where they are set.
 */
export function GoalsCard({
  seasonId,
  year,
  className,
}: {
  seasonId: Id<"seasons">;
  year: number;
  className?: string;
}) {
  const data = useQuery(api.seasons.goals.list, { seasonId });
  const userTeam = useFranchise()?.userTeam;
  if (data === null) return null;
  const goals = data?.goals ?? [];
  const hits = goals.filter((g) => g.evaluation.status === "hit").length;
  const report = (
    <Link to="/history/reports/$year" params={{ year: String(year) }} hash="goals">
      {goals.length > 0 ? "Edit" : "Set goals"}
    </Link>
  );

  return (
    <Section
      title="Goals"
      className={className}
      actions={
        goals.length > 0 && (
          <>
            <span className="num text-sm text-muted-foreground">
              {hits} of {goals.length} hit
            </span>
            <Button asChild size="sm" variant="ghost">
              {report}
            </Button>
          </>
        )
      }
    >
      {data === undefined ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description={`Set what ${year} should bring on the pre-season report.`}
          action={
            <Button asChild size="sm" variant="outline">
              {report}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {goals.map(({ goal, evaluation, player }) => (
            <li key={goal._id}>
              <GoalLine
                goal={goal}
                evaluation={evaluation}
                player={player && { ...player, team: userTeam }}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
