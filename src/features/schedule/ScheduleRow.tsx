import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { weekLabel, weekPhase } from "@shared/domain";
import { formatRecord } from "@shared/stats";
import { GameStars } from "@/components/player/GameStars";
import { ResultBadge } from "@/components/team/ResultBadge";
import { TeamLogo, type TeamLike } from "@/components/team/TeamLogo";
import { cn } from "@/lib/cn";

export type ScheduleGame = FunctionReturnType<typeof api.games.schedule.bySeason>["games"][number];

/** Stars and notes in full; the card grows to fit them. */
function Extras({ game, userTeam }: { game: ScheduleGame; userTeam: TeamLike }) {
  if (game.stars.length === 0 && !game.notes) return null;
  return (
    <div className="min-w-0 space-y-2 [grid-area:extra]">
      {game.stars.length > 0 && (
        <GameStars stars={game.stars} team={userTeam} opponent={game.opponent} layout="chips" />
      )}
      {game.notes && (
        <p className="text-sm break-words whitespace-pre-line text-muted-foreground">{game.notes}</p>
      )}
    </div>
  );
}

/**
 * One week. Phone: week, opponent and result on one line, then every star and the notes below.
 * Wide: week, opponent and result on the left, stars and notes filling the rest (grid areas
 * switch on the row's own width). The whole card opens the game; star chips open the player.
 */
export function ScheduleRow({ game, userTeam }: { game: ScheduleGame; userTeam: TeamLike }) {
  const postseason = weekPhase(game.weekKey) === "postseason";
  const bye = game.status === "bye";
  const opponent = game.opponent?.name ?? "TBD";
  // A stretched link: the week label's ::after covers the card, star links sit above it.
  const cardLink = (
    <Link
      to="/games/$gameId"
      params={{ gameId: game._id }}
      aria-label={
        bye
          ? `${weekLabel(game.weekKey, "long")}: bye week`
          : `${weekLabel(game.weekKey, "long")} ${game.userIsHome ? "vs" : "at"} ${opponent}`
      }
      className={cn(
        "font-display text-base leading-tight font-semibold uppercase [grid-area:week] after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary",
        bye && "text-subtle-foreground",
      )}
    >
      {weekLabel(game.weekKey)}
    </Link>
  );

  return (
    <div
      className={cn(
        "@container relative rounded-xl border transition-colors",
        bye ? "border-dashed border-border" : "border-border bg-surface hover:bg-surface-2",
        postseason && !bye && "border-l-4 border-l-primary",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 @desktop:grid-cols-[4.5rem_minmax(11rem,16rem)_7.5rem_minmax(0,1fr)] @desktop:items-start @desktop:[grid-template-areas:'week_opp_res_extra']",
          // No empty second row (and its gap) on phones when there is nothing to show under the score.
          game.stars.length > 0 || game.notes
            ? "[grid-template-areas:'week_opp_res'_'extra_extra_extra']"
            : "[grid-template-areas:'week_opp_res']",
        )}
      >
        {cardLink}
        {bye ? (
          <span className="text-sm text-muted-foreground [grid-area:opp]">Bye week</span>
        ) : (
          <>
            <span className="flex min-w-0 items-center gap-1.5 [grid-area:opp]">
              <span className="w-5 shrink-0 text-xs text-subtle-foreground">
                {game.userIsHome ? "vs" : "@"}
              </span>
              {game.opponent && (
                <span className="flex min-w-0 items-center gap-2">
                  <TeamLogo team={game.opponent} size="sm" />
                  <span className="min-w-0 leading-tight">
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
          </>
        )}
        <Extras game={game} userTeam={userTeam} />
      </div>
    </div>
  );
}
