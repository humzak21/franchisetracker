import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { GoalOutcome } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { errorMessage } from "@/lib/errors";
import { draftFromGoal, NEW_GOAL, specFromDraft, type GoalDraft } from "./goalDraft";
import { GoalFields } from "./GoalFields";
import type { GoalRow } from "./types";

const OUTCOME_OPTIONS: { value: GoalOutcome | "auto"; label: string }[] = [
  { value: "auto", label: "From the numbers" },
  { value: "hit", label: "Hit" },
  { value: "missed", label: "Missed" },
];

/** Adds a goal, or edits, marks or removes one (`goal` given). */
export function GoalSheet({
  seasonId,
  goal,
  open,
  onOpenChange,
}: {
  seasonId: Id<"seasons">;
  goal?: GoalRow["goal"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useMutation(api.seasons.goals.add);
  const update = useMutation(api.seasons.goals.update);
  const setOutcome = useMutation(api.seasons.goals.setOutcome);
  const remove = useMutation(api.seasons.goals.remove);
  const [draft, setDraft] = useState<GoalDraft>(goal ? draftFromGoal(goal) : NEW_GOAL);
  const [error, setError] = useState<string | null>(null);

  const run = async (step: () => Promise<unknown>) => {
    setError(null);
    try {
      await step();
      if (!goal) setDraft(NEW_GOAL);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = specFromDraft(draft);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    void run(async () => {
      if (!goal) return await add({ seasonId, ...result.spec });
      await update({ goalId: goal._id, ...result.spec });
      // After the rewrite, which drops a manual outcome when the kind of goal changes.
      await setOutcome({ goalId: goal._id, outcome: draft.outcome === "auto" ? null : draft.outcome });
    });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? "Edit goal" : "Add a goal"}
      description="What this season should accomplish, for the team or one player."
    >
      <form onSubmit={submit} className="space-y-3">
        <GoalFields seasonId={seasonId} draft={draft} onChange={setDraft} />
        {goal && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Outcome</p>
            <Segmented
              aria-label="Outcome"
              value={draft.outcome}
              onChange={(outcome) => setDraft({ ...draft, outcome })}
              options={OUTCOME_OPTIONS}
              className="flex w-full"
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {goal && (
            <Button variant="ghost" onClick={() => void run(() => remove({ goalId: goal._id }))}>
              <Trash2 /> Remove
            </Button>
          )}
          <Button type="submit" variant="primary" className="ml-auto">
            {goal ? "Save" : "Add goal"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
