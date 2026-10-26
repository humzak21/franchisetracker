import { useQuery } from "convex/react";
import { GitBranch } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PLAYOFF_ROUND_LABELS, PLAYOFF_ROUNDS } from "@shared/domain";
import { buildBracket, type BracketGame } from "@shared/league/standings";
import { useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { Badge, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { TeamLink } from "./TeamLink";
import { toRow, type Standing } from "./types";

function Side({
  team,
  seed,
  won,
  decided,
  user,
}: {
  team: Standing["team"];
  seed: number;
  won: boolean;
  decided: boolean;
  user: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-2 px-3",
        decided && !won && "opacity-55",
        user && "bg-elite-1",
      )}
    >
      <Badge className="num w-6 justify-center">{seed}</Badge>
      <TeamLink team={team} size="xs" className="flex-1" />
      {won && <span className="text-xs font-semibold text-win">Won</span>}
    </div>
  );
}

function Game({
  game,
  teams,
  userAbbr,
}: {
  game: BracketGame;
  teams: Map<string, Standing["team"]>;
  userAbbr?: string;
}) {
  const home = teams.get(game.home.teamAbbr);
  const away = teams.get(game.away.teamAbbr);
  if (!home || !away) return null;
  const decided = game.winner !== null;
  return (
    <article className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      <Side
        team={away}
        seed={game.away.seed}
        won={game.winner === away.abbr}
        decided={decided}
        user={away.abbr === userAbbr}
      />
      <Side
        team={home}
        seed={game.home.seed}
        won={game.winner === home.abbr}
        decided={decided}
        user={home.abbr === userAbbr}
      />
    </article>
  );
}

/**
 * The playoff bracket (FEATURES.md 5.6) rebuilt from seeds and results: one column per round on
 * wide screens, a vertical round-by-round list on a phone.
 */
export function PlayoffsView({ seasonId }: { seasonId: Id<"seasons"> }) {
  const rows = useQuery(api.league.standings.bySeason, { seasonId });
  const userAbbr = useFranchise()?.userTeam.abbr;
  if (rows === undefined) return <Skeleton className="h-80 rounded-xl" />;
  const games = buildBracket(rows.map(toRow));
  if (games.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No bracket yet"
        description="The bracket appears once the standings with playoff seeds are in for the season."
      />
    );
  }
  const teams = new Map(rows.map((r) => [r.team.abbr, r.team]));
  return (
    <div className="@container">
      <div className="grid gap-5 @desktop:grid-cols-4">
        {PLAYOFF_ROUNDS.map((round) => {
          const inRound = games.filter((g) => g.round === round);
          if (inRound.length === 0) return null;
          return (
            <section key={round} aria-label={PLAYOFF_ROUND_LABELS[round].long} className="space-y-2">
              <h3 className="font-display text-base font-semibold tracking-wide uppercase">
                {PLAYOFF_ROUND_LABELS[round].long}
              </h3>
              {inRound.map((g, i) => (
                <div key={i} className="space-y-1">
                  {g.conference && (i === 0 || inRound[i - 1]?.conference !== g.conference) && (
                    <div className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                      {g.conference}
                    </div>
                  )}
                  <Game game={g} teams={teams} userAbbr={userAbbr} />
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
