import { Link } from "@tanstack/react-router";
import { CircleCheck, CircleDashed, CircleHelp, CircleX, Trophy, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { GoalType } from "@shared/domain";
import {
  goalFraction,
  GOAL_STATUS_LABELS,
  type GoalEvaluation,
  type GoalStatus,
} from "@shared/seasons/goals";
import { goalTitle } from "@shared/seasons/goalSpec";
import { isStatKey, type StatKey } from "@shared/stats";
import { PlayerChip, type PlayerLike } from "@/components/player/PlayerChip";
import { Badge, type BadgeProps } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { StatCell } from "./StatCell";

const STATUS: Record<GoalStatus, { icon: LucideIcon; tone: BadgeProps["tone"]; iconClass: string }> = {
  hit: { icon: Trophy, tone: "win", iconClass: "bg-win text-background" },
  missed: { icon: CircleX, tone: "loss", iconClass: "bg-loss/15 text-loss" },
  in_progress: { icon: CircleDashed, tone: "neutral", iconClass: "bg-surface-2 text-muted-foreground" },
  pending: { icon: CircleHelp, tone: "warn", iconClass: "bg-warn/15 text-warn" },
};

type GoalLineProps = {
  goal: { type: GoalType; statKey?: string; target?: number; text?: string };
  evaluation: Pick<GoalEvaluation, "status" | "progress"> &
    Partial<Pick<GoalEvaluation, "manual" | "onTrack">>;
  /** A player goal's player, shown above the title and linked to his page. */
  player?: (PlayerLike & { _id: string }) | null;
  /** Trailing controls: edit, reorder. */
  actions?: ReactNode;
  className?: string;
};

function Value({ stat, value }: { stat?: StatKey; value: number | null }) {
  return stat ? <StatCell stat={stat} value={value} /> : <span className="num">{value ?? "—"}</span>;
}

/**
 * One pre-season goal: its status, the goal in words, and progress toward the target. A goal hit
 * is celebrated in the win color; a lower-is-better limit fills toward the line it must stay under.
 */
export function GoalLine({ goal, evaluation, player, actions, className }: GoalLineProps) {
  const { status, progress, manual, onTrack } = evaluation;
  const title = goalTitle(goal);
  const stat = goal.statKey !== undefined && isStatKey(goal.statKey) ? goal.statKey : undefined;
  const { icon: Icon, tone, iconClass } = STATUS[status];
  const fraction = progress ? goalFraction(progress) : 0;
  const hit = status === "hit";
  return (
    <div
      className={cn(
        "flex min-h-14 items-start gap-3 rounded-xl border px-3 py-2.5",
        hit ? "border-win/40 bg-win/10" : "border-border bg-surface",
        className,
      )}
    >
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", iconClass)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {player && (
          <Link to="/players/$playerId" params={{ playerId: player._id }} className="block w-fit">
            <PlayerChip player={player} size="sm" />
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("min-w-0 text-sm font-medium", status === "missed" && "text-muted-foreground")}>
            {title}
          </span>
          <Badge tone={tone}>
            {hit && <CircleCheck className="size-3" aria-hidden />}
            {GOAL_STATUS_LABELS[status]}
            {manual && " · by hand"}
          </Badge>
          {onTrack && <Badge tone="accent">On track</Badge>}
        </div>
        {progress && (
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label={`${title} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(fraction * 100)}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  hit
                    ? "bg-win"
                    : status === "missed"
                      ? "bg-loss"
                      : progress.better === "lower"
                        ? "bg-warn"
                        : "bg-primary",
                )}
                style={{ width: `${fraction * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              <Value stat={stat} value={progress.current} /> {progress.better === "higher" ? "of" : "max"}{" "}
              <Value stat={stat} value={progress.target} />
            </span>
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
    </div>
  );
}
