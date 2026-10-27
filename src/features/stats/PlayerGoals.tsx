import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useFranchise } from "@/app/franchise";
import { GoalLine } from "@/components/data/GoalLine";
import { Section } from "@/components/layout/Section";
import { useQuery } from "@/lib/convex/useQuery";

/**
 * The season's player goals above the stat tables (FEATURES.md 5.5, 5.11): each player's target,
 * progress from his game logs, and a goal hit marked in the win color. Nothing when none are set,
 * so it never pushes the tables down for a placeholder.
 */
export function PlayerGoals({ seasonId }: { seasonId: Id<"seasons"> }) {
  const data = useQuery(api.seasons.goals.list, { seasonId });
  const userTeam = useFranchise()?.userTeam;
  const goals = data?.goals.filter((g) => g.goal.scope === "player") ?? [];
  if (!data || goals.length === 0) return null;
  const hits = goals.filter((g) => g.evaluation.status === "hit").length;

  return (
    <Section
      title="Player goals"
      actions={
        <span className="num text-sm text-muted-foreground">
          {hits} of {goals.length} hit
        </span>
      }
    >
      <ul className="grid gap-2 @tablet:grid-cols-2">
        {goals.map(({ goal, evaluation, player }) => (
          <li key={goal._id}>
            <GoalLine
              goal={goal}
              evaluation={evaluation}
              className="h-full"
              player={player && { ...player, team: userTeam }}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
