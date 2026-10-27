/**
 * Pre-season goals, evaluated (FEATURES.md 5.11): whether each goal is hit, missed, still in
 * progress, or waiting for the owner to mark it, with current-versus-target progress where the
 * numbers say. A goal is missed only once it can no longer be hit: the regular season or the
 * playoff run is decided. A manual outcome always wins. Pure; used by Convex and the UI.
 */
import type { PlayoffResult, PlayoffRound, SeasonStatus } from "../domain/calendar";
import type { GoalOutcome, GoalScope, GoalType } from "../domain/goals";
import type { WLT } from "../games/summary";
import { statValue } from "../stats/aggregate";
import { isRawStatKey, isStatKey, STAT_REGISTRY, type StatLine } from "../stats/registry";

export const GOAL_STATUSES = ["hit", "missed", "in_progress", "pending"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  hit: "Goal hit",
  missed: "Missed",
  in_progress: "In progress",
  pending: "Mark it",
};

export type GoalLike = {
  scope: GoalScope;
  type: GoalType;
  statKey?: string;
  target?: number;
  outcome?: GoalOutcome;
};

/** What the team goals read: the season's record, standing and playoff run. */
export type TeamFacts = {
  year: number;
  status: SeasonStatus;
  regular: WLT;
  divisionRank: number | null;
  seed: number | null;
  /** Where the playoff run ended; null while it is going or before it starts. */
  playoffResult: PlayoffResult | null;
  /** Playoff games the user team played, by round. */
  playoffGames: readonly { round: PlayoffRound; won: boolean }[];
  /** A first-round bye on the schedule. */
  bye: boolean;
};

/** A player's regular-season totals for the season, or null when he has none yet. */
export type PlayerFacts = { totals: StatLine; games: number } | null;

export type GoalProgress = { current: number | null; target: number; better: "higher" | "lower" };

export type GoalEvaluation = {
  status: GoalStatus;
  progress: GoalProgress | null;
  /** The owner marked it by hand. */
  manual: boolean;
  /** In progress and where it needs to be right now (a rate stat above its target mid-season). */
  onTrack: boolean;
};

/** Seeds with a first-round bye: one since the 2020 seven-seed format, two before. */
export function byeSeeds(year: number): number {
  return year >= 2020 ? 1 : 2;
}

/** Seeds held by division winners: four since the 2002 realignment, three before. */
export function divisionWinnerSeeds(year: number): number {
  return year >= 2002 ? 4 : 3;
}

const regularDone = (f: TeamFacts) => f.status === "postseason" || f.status === "complete";
/** The playoff run is over: eliminated, champion, or out of the playoffs altogether. */
const runDecided = (f: TeamFacts) => f.playoffResult !== null || f.status === "complete";
const wonRound = (f: TeamFacts, round: PlayoffRound) =>
  f.playoffGames.some((g) => g.round === round && g.won);
const finalSeed = (f: TeamFacts) => (regularDone(f) ? f.seed : null);

type Verdict = GoalStatus;

function decided(hit: boolean, missed: boolean): Verdict {
  return hit ? "hit" : missed ? "missed" : "in_progress";
}

function teamVerdict(type: GoalType, f: TeamFacts): Verdict {
  const seed = finalSeed(f);
  const result = f.playoffResult;
  switch (type) {
    case "division": {
      if (!regularDone(f)) return "in_progress";
      if (f.divisionRank === 1 || (seed !== null && seed <= divisionWinnerSeeds(f.year))) return "hit";
      if (f.divisionRank !== null || seed !== null || result === "missed") return "missed";
      return f.status === "complete" ? "pending" : "in_progress";
    }
    case "playoffs": {
      const hit =
        f.playoffGames.length > 0 || f.bye || seed !== null || (result !== null && result !== "missed");
      return decided(hit, result === "missed" || f.status === "complete");
    }
    case "bye": {
      const hit = f.bye || (seed !== null && seed <= byeSeeds(f.year));
      const out = f.playoffGames.some((g) => g.round === "wc") || result === "missed" || seed !== null;
      if (hit || out) return decided(hit, out);
      return f.status === "complete" ? "pending" : "in_progress";
    }
    case "playoff_win": {
      const hit =
        f.playoffGames.some((g) => g.won) ||
        result === "conf_loss" ||
        result === "sb_loss" ||
        result === "champion";
      return decided(hit, runDecided(f));
    }
    case "super_bowl_appearance": {
      const hit =
        wonRound(f, "conf") ||
        f.playoffGames.some((g) => g.round === "sb") ||
        result === "sb_loss" ||
        result === "champion";
      return decided(hit, runDecided(f));
    }
    case "super_bowl_win":
      return decided(wonRound(f, "sb") || result === "champion", runDecided(f));
    default:
      return "pending";
  }
}

function statVerdict(goal: GoalLike, player: PlayerFacts, done: boolean) {
  if (goal.statKey === undefined || !isStatKey(goal.statKey) || goal.target === undefined) return null;
  const key = goal.statKey;
  const { better } = STAT_REGISTRY[key];
  const value = player ? statValue(key, player.totals, { games: player.games }) : null;
  // A counting stat nobody recorded is zero; a rate with nothing under it has no value yet.
  const current = value ?? (isRawStatKey(key) ? 0 : null);
  const meets = current !== null && (better === "higher" ? current >= goal.target : current <= goal.target);
  const progress: GoalProgress = { current, target: goal.target, better };
  // Counting stats only grow: reaching a higher-is-better target, or passing a lower-is-better
  // limit, settles the goal mid-season. Rates move both ways, so they wait for the season's end.
  let status: Verdict;
  if (done) status = meets ? "hit" : "missed";
  else if (!isRawStatKey(key)) status = "in_progress";
  else if (better === "higher") status = meets ? "hit" : "in_progress";
  else status = meets ? "in_progress" : "missed";
  return { status, progress, meets };
}

/** Evaluates one goal against the season. `player` is the goal player's totals (player goals only). */
export function evaluateGoal(goal: GoalLike, team: TeamFacts, player: PlayerFacts = null): GoalEvaluation {
  let status: Verdict = "pending";
  let progress: GoalProgress | null = null;
  let meets = false;
  if (goal.type === "wins" && goal.target !== undefined) {
    progress = { current: team.regular.w, target: goal.target, better: "higher" };
    meets = team.regular.w >= goal.target;
    status = decided(meets, regularDone(team));
  } else if (goal.type === "stat") {
    const verdict = statVerdict(goal, player, regularDone(team));
    if (verdict) ({ status, progress, meets } = verdict);
  } else if (goal.type !== "custom") {
    status = teamVerdict(goal.type, team);
  }
  if (goal.outcome) return { status: goal.outcome, progress, manual: true, onTrack: false };
  return { status, progress, manual: false, onTrack: status === "in_progress" && meets };
}

/** How full a progress bar is, 0 to 1. A lower-is-better limit fills as the value nears it. */
export function goalFraction(progress: GoalProgress): number {
  if (progress.current === null) return 0;
  if (progress.target <= 0) return progress.better === "higher" ? 1 : progress.current > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, progress.current / progress.target));
}
