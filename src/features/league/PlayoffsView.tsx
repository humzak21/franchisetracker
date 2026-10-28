import { PLAYOFF_ROUND_LABELS, PLAYOFF_ROUNDS } from "@shared/domain";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { TeamLink } from "./TeamLink";
import type { Board, BoardRow } from "./types";

type BracketGame = Board["bracket"][number];

function Side({
  team,
  seed,
  won,
  decided,
}: {
  team: BoardRow["team"];
  seed: number;
  won: boolean;
  decided: boolean;
}) {
  return (
    <div className={cn("flex min-h-11 items-center gap-2 px-3", decided && !won && "opacity-55")}>
      <Badge className="num w-6 justify-center">{seed}</Badge>
      <TeamLink team={team} size="xs" className="flex-1" />
      {won && <span className="text-xs font-semibold text-win">Won</span>}
    </div>
  );
}

function Game({ game, teams }: { game: BracketGame; teams: Map<string, BoardRow["team"]> }) {
  const home = teams.get(game.home.abbr);
  const away = teams.get(game.away.abbr);
  if (!home || !away) return null;
  const decided = game.winner !== null;
  return (
    <article className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      <Side team={away} seed={game.away.seed} won={game.winner === away.abbr} decided={decided} />
      <Side team={home} seed={game.home.seed} won={game.winner === home.abbr} decided={decided} />
    </article>
  );
}

/**
 * The playoff bracket (FEATURES.md 5.6): the projected field while the regular season runs, the
 * real one after, filled in as the playoff scores arrive. One column per round on wide screens,
 * round by round on a phone.
 */
export function PlayoffsView({ board }: { board: Board }) {
  const teams = new Map(board.rows.map((r) => [r.team.abbr, r.team]));
  return (
    <div className="grid gap-5 @desktop:grid-cols-4">
      {PLAYOFF_ROUNDS.map((round) => {
        const inRound = board.bracket.filter((g) => g.round === round);
        if (inRound.length === 0) return null;
        return (
          <section key={round} aria-label={PLAYOFF_ROUND_LABELS[round].long} className="space-y-2">
            <h3 className="font-display text-base font-semibold tracking-wide uppercase">
              {PLAYOFF_ROUND_LABELS[round].long}
            </h3>
            {inRound.map((g, i) => (
              <div key={`${g.home.abbr}-${g.away.abbr}`} className="space-y-1">
                {g.conference && (i === 0 || inRound[i - 1]?.conference !== g.conference) && (
                  <div className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                    {g.conference}
                  </div>
                )}
                <Game game={g} teams={teams} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
