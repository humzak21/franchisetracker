import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { weekLabel, weekPhase } from "@shared/domain";
import { formatRecord } from "@shared/stats";
import { Headshot } from "@/components/player/Headshot";
import { ResultBadge } from "@/components/team/ResultBadge";
import { TeamLogo, type TeamLike } from "@/components/team/TeamLogo";
import { cn } from "@/lib/cn";

export type ScheduleGame = FunctionReturnType<typeof api.games.schedule.bySeason>["games"][number];

/**
 * One week. Phone: week, opponent and result on one line, stars and notes below.
 * Wide: a single row (grid areas switch on the row's own width).
 */
export function ScheduleRow({ game, userTeam }: { game: ScheduleGame; userTeam?: TeamLike }) {
  const postseason = weekPhase(game.weekKey) === "postseason";

  if (game.status === "bye") {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        <span className="w-14 font-display text-base font-semibold text-subtle-foreground uppercase">
          {weekLabel(game.weekKey)}
        </span>
        Bye week
      </div>
    );
  }

  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game._id }}
      className={cn(
        "@container block rounded-xl border border-border bg-surface transition-colors hover:bg-surface-2",
        postseason && "border-l-4 border-l-primary",
      )}
    >
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 [grid-template-areas:'week_opp_res'_'stars_stars_stars'_'notes_notes_notes'] @desktop:grid-cols-[4.5rem_minmax(11rem,1fr)_7.5rem_minmax(12rem,1.2fr)_minmax(0,1.6fr)] @desktop:[grid-template-areas:'week_opp_res_stars_notes']">
        <span className="font-display text-base leading-tight font-semibold uppercase [grid-area:week]">
          {weekLabel(game.weekKey)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 [grid-area:opp]">
          <span className="w-5 shrink-0 text-xs text-subtle-foreground">{game.userIsHome ? "vs" : "@"}</span>
          {game.opponent && (
            <span className="flex min-w-0 items-center gap-2">
              <TeamLogo team={game.opponent} size="sm" />
              <span className="min-w-0 leading-tight @desktop:flex @desktop:items-baseline @desktop:gap-1.5">
                <span className="block truncate font-medium">{game.opponent.name}</span>
                {game.opponentRecord && (
                  <span className="num block text-xs text-muted-foreground">
                    {formatRecord(game.opponentRecord)}
                  </span>
                )}
              </span>
            </span>
          )}
        </span>
        <span className="justify-self-end [grid-area:res] @desktop:justify-self-start">
          <ResultBadge result={game.result} us={game.us} them={game.them} overtime={game.overtime} />
        </span>
        {game.stars.length > 0 && (
          <span className="flex min-w-0 items-center gap-3 overflow-hidden text-xs text-muted-foreground [grid-area:stars]">
            {game.stars.map((star, i) => (
              <span key={`${star.name}-${i}`} className="flex min-w-0 items-center gap-1.5">
                <Headshot name={star.name} size="xs" team={star.playerId ? userTeam : undefined} />
                <span className="truncate">{star.name.split(" ").slice(-1)[0]}</span>
              </span>
            ))}
          </span>
        )}
        {game.notes && (
          <p className="line-clamp-2 text-xs text-muted-foreground [grid-area:notes] @desktop:line-clamp-1">
            {game.notes}
          </p>
        )}
      </div>
    </Link>
  );
}
