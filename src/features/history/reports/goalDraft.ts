/** The goal sheet's form state and its conversion to what the goal mutations take. Pure. */
import type { Id } from "@convex/_generated/dataModel";
import type { GoalOutcome, GoalScope, GoalType } from "@shared/domain";
import { goalSpecError } from "@shared/seasons/goalSpec";

/** Text inputs stay strings while typing; numbers are parsed on save. */
export type GoalDraft = {
  scope: GoalScope;
  type: GoalType;
  playerId: string;
  statKey: string;
  target: string;
  text: string;
  /** "auto" leaves the goal to the numbers. */
  outcome: GoalOutcome | "auto";
};

export type GoalSpecArgs = {
  scope: GoalScope;
  type: GoalType;
  playerId?: Id<"players">;
  statKey?: string;
  target?: number;
  text?: string;
};

export const NEW_GOAL: GoalDraft = {
  scope: "team",
  type: "playoffs",
  playerId: "",
  statKey: "",
  target: "",
  text: "",
  outcome: "auto",
};

export function draftFromGoal(goal: {
  scope: GoalScope;
  type: GoalType;
  playerId?: string;
  statKey?: string;
  target?: number;
  text?: string;
  outcome?: GoalOutcome;
}): GoalDraft {
  return {
    scope: goal.scope,
    type: goal.type,
    playerId: goal.playerId ?? "",
    statKey: goal.statKey ?? "",
    target: goal.target === undefined ? "" : String(goal.target),
    text: goal.text ?? "",
    outcome: goal.outcome ?? "auto",
  };
}

/** Switching team ↔ player picks that side's default kind of goal. */
export function withScope(draft: GoalDraft, scope: GoalScope): GoalDraft {
  if (scope === draft.scope) return draft;
  return { ...draft, scope, type: scope === "team" ? "playoffs" : "stat" };
}

/** What the mutations take, or the reason it cannot be saved yet. */
export function specFromDraft(draft: GoalDraft): { spec: GoalSpecArgs } | { error: string } {
  const usesTarget = draft.type === "wins" || draft.type === "stat";
  const target = usesTarget && draft.target.trim() !== "" ? Number(draft.target) : undefined;
  const spec: GoalSpecArgs = {
    scope: draft.scope,
    type: draft.type,
    playerId: draft.scope === "player" && draft.playerId ? (draft.playerId as Id<"players">) : undefined,
    statKey: draft.type === "stat" && draft.statKey ? draft.statKey : undefined,
    target,
    text: draft.type === "custom" ? draft.text.trim() || undefined : undefined,
  };
  const error = goalSpecError({ ...spec, hasPlayer: spec.playerId !== undefined });
  return error ? { error } : { spec };
}
