import { ChevronRight, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { PAT_LABELS, type PatResult } from "@shared/domain";
import { formatClock, playPeriodLabel } from "@shared/games/scoringPlay";
import { TeamLogo, type TeamLike } from "@/components/team/TeamLogo";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

export type SummaryPlay = {
  id: string;
  period: number;
  clock: number;
  team: TeamLike;
  /** The play in words, rendered from its fields. */
  description: string;
  /** The line as the screen printed it, for the tooltip. */
  printed: string | null;
  pat: PatResult | null;
  /** The score after the play, away first like the score bug. */
  score: string;
  gameWinner: boolean;
  needsPlayer: boolean;
  /** Who a nameless play can only be: assigned in one tap. */
  suggestion: string | null;
};

const PAT_TAGS: Record<PatResult, string | null> = {
  kick: null,
  kick_failed: "XP missed",
  two: "2PT",
  two_failed: "2PT failed",
  none: null,
};

/**
 * Every score of a game by period: who, when, the score after it and a tag for an unusual try.
 * A tap on a play changes its player; a play missing one says so and offers who it can only be.
 */
export function ScoringSummary({
  plays,
  onPick,
  onAssign,
}: {
  plays: readonly SummaryPlay[];
  onPick?: (play: SummaryPlay) => void;
  onAssign?: (play: SummaryPlay) => void;
}) {
  const periods = [...new Set(plays.map((p) => p.period))];
  return (
    <div className="space-y-3">
      {periods.map((period) => (
        <section key={period} aria-label={playPeriodLabel(period)}>
          <h4 className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            {playPeriodLabel(period)}
          </h4>
          <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
            {plays
              .filter((p) => p.period === period)
              .map((play) => (
                <PlayRow key={play.id} play={play} onPick={onPick} onAssign={onAssign} />
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function PlayRow({
  play,
  onPick,
  onAssign,
}: {
  play: SummaryPlay;
  onPick?: (play: SummaryPlay) => void;
  onAssign?: (play: SummaryPlay) => void;
}) {
  const tag = play.pat ? PAT_TAGS[play.pat] : null;
  const body: ReactNode = (
    <>
      <TeamLogo team={play.team} size="sm" className="shrink-0" />
      <span className="min-w-0 flex-1" title={play.printed ?? undefined}>
        <span className="block text-sm font-medium">{play.description}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="num">{formatClock(play.clock)}</span>
          {tag && <Badge title={play.pat ? PAT_LABELS[play.pat] : undefined}>{tag}</Badge>}
          {play.gameWinner && (
            <Badge tone="accent">
              <Trophy className="size-3" /> Game-winner
            </Badge>
          )}
          {play.needsPlayer && <span className="text-warn">Needs a player</span>}
        </span>
      </span>
      <span className="num shrink-0 font-display text-lg font-bold">{play.score}</span>
    </>
  );
  return (
    <li className="flex flex-wrap items-center gap-x-2">
      {onPick ? (
        <button
          type="button"
          onClick={() => onPick(play)}
          aria-label={`Change the player on ${play.description}`}
          className={cn(
            "flex min-h-14 min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left hover:bg-surface-2",
          )}
        >
          {body}
          <ChevronRight className="size-4 shrink-0 text-subtle-foreground" />
        </button>
      ) : (
        <div className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5">{body}</div>
      )}
      {play.needsPlayer && play.suggestion && onAssign && (
        <button
          type="button"
          onClick={() => onAssign(play)}
          className="mx-3 mb-2 min-h-11 basis-full rounded-lg bg-primary/10 px-3 text-left text-sm font-medium text-primary hover:bg-primary/20"
        >
          Assign {play.suggestion}
        </button>
      )}
    </li>
  );
}
