/**
 * What a pre-season goal may say (FEATURES.md 5.11) and how it reads: validation shared by the
 * goal sheet and the Convex mutations, and the one-line title every goal list shows. Pure.
 */
import { GOAL_TYPE_LABELS, TEAM_GOAL_TYPES, type GoalScope, type GoalType } from "../domain/goals";
import { formatStat } from "../stats/format";
import {
  isStatKey,
  STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsInCategory,
  type StatKey,
} from "../stats/registry";

/** Most wins a goal can ask for: a full regular season, with headroom for longer schedules. */
export const MAX_WINS_TARGET = 20;
export const MAX_GOAL_TEXT = 200;
/** Goals one season can hold. */
export const MAX_GOALS = 30;

/** Player goals: a stat target, or a write-in. */
export const PLAYER_GOAL_TYPES = ["stat", "custom"] as const satisfies readonly GoalType[];

export type GoalSpec = {
  scope: GoalScope;
  type: GoalType;
  hasPlayer: boolean;
  statKey?: string;
  target?: number;
  text?: string;
};

/** Why a goal cannot be saved, or null when it can. */
export function goalSpecError(spec: GoalSpec): string | null {
  const text = spec.text?.trim() ?? "";
  if (text.length > MAX_GOAL_TEXT) return `Keep it under ${MAX_GOAL_TEXT} characters`;
  if (spec.scope === "team") {
    if (!(TEAM_GOAL_TYPES as readonly GoalType[]).includes(spec.type)) return "Pick a team goal";
    if (spec.hasPlayer) return "Team goals have no player";
  } else {
    if (!(PLAYER_GOAL_TYPES as readonly GoalType[]).includes(spec.type)) return "Pick a stat or write one in";
    if (!spec.hasPlayer) return "Pick a player";
  }
  if (spec.type === "custom" && text === "") return "Write the goal in";
  if (spec.type === "wins") {
    const t = spec.target;
    if (t === undefined || !Number.isInteger(t) || t < 1 || t > MAX_WINS_TARGET) {
      return `Wins must be a whole number from 1 to ${MAX_WINS_TARGET}`;
    }
  }
  if (spec.type === "stat") {
    if (spec.statKey === undefined || !isStatKey(spec.statKey)) return "Pick a stat";
    if (spec.target === undefined || !Number.isFinite(spec.target) || spec.target < 0) {
      return "Set a target of zero or more";
    }
  } else if (spec.statKey !== undefined) {
    return "Only stat goals name a stat";
  }
  if (spec.type !== "wins" && spec.type !== "stat" && spec.target !== undefined) {
    return "Only wins and stat goals have a target";
  }
  return null;
}

/** "≥" for stats where more is better, "≤" for ones to keep down (interceptions thrown). */
export function targetSign(key: StatKey): string {
  return STAT_REGISTRY[key].better === "higher" ? "≥" : "≤";
}

/** The goal in one line: "Win at least 11 games", "Passing yards ≥ 4,500", a write-in's text. */
export function goalTitle(goal: {
  type: GoalType;
  statKey?: string;
  target?: number;
  text?: string;
}): string {
  if (goal.type === "custom") return goal.text?.trim() || GOAL_TYPE_LABELS.custom;
  if (goal.type === "wins") {
    const n = goal.target ?? 0;
    return `${GOAL_TYPE_LABELS.wins} ${n} ${n === 1 ? "game" : "games"}`;
  }
  if (goal.type === "stat") {
    if (goal.statKey === undefined || !isStatKey(goal.statKey)) return GOAL_TYPE_LABELS.stat;
    const key = goal.statKey;
    return `${STAT_REGISTRY[key].label} ${targetSign(key)} ${formatStat(key, goal.target ?? 0)}`;
  }
  return GOAL_TYPE_LABELS[goal.type];
}

/** Every stat for the goal picker, grouped by category in registry order. */
export const STAT_GOAL_OPTIONS: readonly { value: StatKey; label: string; group: string }[] =
  STAT_CATEGORIES.flatMap((category) =>
    statsInCategory(category).map((key) => ({
      value: key,
      label: `${STAT_REGISTRY[key].label}${STAT_REGISTRY[key].better === "lower" ? " (keep under)" : ""}`,
      group: STAT_CATEGORY_LABELS[category],
    })),
  );
