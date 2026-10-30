import { useMutation } from "convex/react";
import { ImageUp, ListOrdered, Trophy, UserRoundSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { onlyScorer } from "@shared/games/scorers";
import { EmptyState } from "@/components/data/EmptyState";
import { FactChip } from "@/components/data/FactChip";
import { Notice } from "@/components/data/Notice";
import { ScoreWorm } from "@/components/data/ScoreWorm";
import { ScoringSummary } from "@/components/data/ScoringSummary";
import { ManualEntryLink } from "@/components/forms/ManualEntryLink";
import { Section } from "@/components/layout/Section";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { ScorerSheet } from "./ScorerSheet";
import {
  gameWinnerLine,
  playersMissing,
  rankedScorers,
  summaryPlays,
  wormOf,
  wormPeriodLabel,
  wormPeriods,
  type PlayView,
} from "./scoringViews";

type Side = TeamLike & { _id: Id<"teams"> };

type ScoringSectionProps = {
  gameId: Id<"games">;
  user: Side;
  opponent: Side | null;
  userIsHome: boolean;
  onImport: () => void;
};

/** How a game went score by score: the summary, the worm, who won it, and any play missing a name. */
export function ScoringSection({ gameId, user, opponent, userIsHome, onImport }: ScoringSectionProps) {
  const data = useQuery(api.games.scoring.byGame, { gameId });
  const assign = useMutation(api.games.scoring.assign);
  const [picking, setPicking] = useState<PlayView | null>(null);
  const teamOf = useMemo(
    () => (id: Id<"teams">) => (opponent && id === opponent._id ? opponent : user),
    [opponent, user],
  );
  const plays = useMemo(() => (data ? summaryPlays(data, teamOf, user._id) : []), [data, teamOf, user._id]);
  const actions = (
    <>
      <Button size="sm" variant="outline" onClick={onImport}>
        <ImageUp /> Import scoring summary
      </Button>
      <ManualEntryLink target="scoring_plays" gameId={gameId} label="Type it in" />
    </>
  );

  if (data === undefined) return <Skeleton className="h-40 rounded-xl" />;
  if (data.plays.length === 0) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="No scoring summary yet"
        description="Capture Madden's scoring summary and the quarter scores, game-winner and score worm fill themselves."
        action={<div className="flex flex-wrap justify-center gap-2">{actions}</div>}
      />
    );
  }

  const missing = playersMissing(data, user._id);
  const winner = gameWinnerLine(data);
  const playOf = (id: string) => data.plays.find((p) => p._id === id) ?? null;
  return (
    <Section
      title="Scoring summary"
      actions={<div className="flex flex-wrap justify-end gap-2">{actions}</div>}
    >
      <div className="space-y-3">
        {missing > 0 && (
          <Notice icon={UserRoundSearch}>
            {missing} scoring play{missing === 1 ? " needs" : "s need"} a player
          </Notice>
        )}
        {winner && (
          <Notice icon={Trophy}>
            <span className="font-medium text-foreground">Game-winning score:</span> {winner}
          </Notice>
        )}
        <div className="@container">
          <div className="grid gap-4 @desktop:grid-cols-2 @desktop:items-start">
            <div className="space-y-2 @desktop:order-2">
              <ScoreWorm
                points={wormOf(data, userIsHome)}
                periods={wormPeriods(data)}
                periodLabel={wormPeriodLabel}
                label={`${user.name ?? user.abbr} lead over the game`}
              />
              <div className="flex flex-wrap gap-2">
                <FactChip value={data.leadChanges} label="Lead changes" />
                <FactChip value={data.ties} label="Ties" />
                {data.deficitOvercome > 0 && (
                  <FactChip value={data.deficitOvercome} label="Points overcome" />
                )}
              </div>
            </div>
            <ScoringSummary
              plays={plays}
              onPick={(play) => setPicking(playOf(play.id))}
              onAssign={(play) => {
                const view = playOf(play.id);
                const only = view && onlyScorer(rankedScorers(view, data, play.team.abbr));
                if (view && only) {
                  void assign({ playId: view._id, role: "scorer", playerId: only.playerId });
                }
              }}
            />
          </div>
        </div>
      </div>
      {picking && (
        <ScorerSheet
          gameId={gameId}
          play={picking}
          team={teamOf(picking.teamId)}
          data={data}
          onClose={() => setPicking(null)}
        />
      )}
    </Section>
  );
}
