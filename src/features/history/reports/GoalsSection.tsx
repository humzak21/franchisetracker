import { useMutation } from "convex/react";
import { ChevronDown, ChevronUp, Pencil, Plus, Target } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MAX_GOALS } from "@shared/seasons/goalSpec";
import { useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { GoalLine } from "@/components/data/GoalLine";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { GoalSheet } from "./GoalSheet";
import type { GoalRow } from "./types";

/**
 * The pre-season goals (FEATURES.md 5.11): what the team and its players should accomplish,
 * judged as the season is played. Add, edit, mark by hand, reorder and remove.
 */
export function GoalsSection({ seasonId }: { seasonId: Id<"seasons"> }) {
  const data = useQuery(api.seasons.goals.list, { seasonId });
  const move = useMutation(api.seasons.goals.move);
  const userTeam = useFranchise()?.userTeam;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<GoalRow["goal"] | null>(null);
  const goals = data?.goals ?? [];
  const hits = goals.filter((g) => g.evaluation.status === "hit").length;

  return (
    <Section
      id="goals"
      title="Goals"
      description="What this season should accomplish: wins, the playoffs, a title, a player's numbers."
      actions={
        goals.length > 0 ? (
          <span className="num text-sm text-muted-foreground">
            {hits} of {goals.length} hit
          </span>
        ) : undefined
      }
    >
      {data === undefined ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : (
        <div className="space-y-3">
          {goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No goals set"
              description="Set targets for the team or a player; Home and Stats track them all season."
            />
          ) : (
            <ul className="space-y-2">
              {goals.map(({ goal, evaluation, player }, i) => (
                <li key={goal._id}>
                  <GoalLine
                    goal={goal}
                    evaluation={evaluation}
                    player={player && { ...player, team: userTeam }}
                    actions={
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={i === 0}
                          aria-label="Move up"
                          onClick={() => void move({ goalId: goal._id, direction: -1 })}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={i === goals.length - 1}
                          aria-label="Move down"
                          onClick={() => void move({ goalId: goal._id, direction: 1 })}
                        >
                          <ChevronDown />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Edit goal"
                          onClick={() => setEditing(goal)}
                        >
                          <Pencil />
                        </Button>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {goals.length < MAX_GOALS && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add goal
            </Button>
          )}
        </div>
      )}
      <GoalSheet seasonId={seasonId} open={adding} onOpenChange={setAdding} />
      {editing && (
        <GoalSheet
          key={editing._id}
          seasonId={seasonId}
          goal={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </Section>
  );
}
