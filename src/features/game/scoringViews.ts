/** Scoring plays as the summary and the worm show them. Pure. */
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { periodLabel } from "@shared/games/lineScore";
import { onlyScorer, scorerCandidates } from "@shared/games/scorers";
import { describePlay, gameLength, needsPlayer, playWhen } from "@shared/games/scoringPlay";
import { wormPoints } from "@shared/stats/scoring";
import type { SummaryPlay } from "@/components/data/ScoringSummary";
import type { WormPoint } from "@/components/data/ScoreWorm";
import type { TeamLike } from "@/components/team/TeamLogo";

export type ScoringData = FunctionReturnType<typeof api.games.scoring.byGame>;
export type PlayView = ScoringData["plays"][number];

const describe = (p: PlayView) =>
  describePlay({ kind: p.kind, yards: p.yards ?? undefined }, { scorer: p.scorer, passer: p.passer });

const others = (p: PlayView, plays: readonly PlayView[]) =>
  plays.filter((o) => o._id !== p._id && o.teamId === p.teamId);

/** Candidates for a play from the box score, those no other play has claimed first. */
export function rankedScorers(p: PlayView, data: ScoringData, teamAbbr: string) {
  return scorerCandidates(p.kind, teamAbbr, data.context?.lines ?? [], others(p, data.plays));
}

/**
 * A play waits on a person when the screen dropped the name, or when it is the user's own scorer
 * and the name matched nobody. An opponent's printed name is enough: that box score is often not
 * captured, so there is usually no one to pick.
 */
function waitsOnPlayer(p: PlayView, userTeamId: Id<"teams">) {
  const unresolved = needsPlayer({ kind: p.kind, playerId: p.playerId ?? undefined });
  return unresolved && (p.scorer === null || p.teamId === userTeamId);
}

/** The plays for `ScoringSummary`. `teamOf` resolves a play's team. */
export function summaryPlays(
  data: ScoringData,
  teamOf: (id: Id<"teams">) => TeamLike,
  userTeamId: Id<"teams">,
): SummaryPlay[] {
  return data.plays.map((p) => {
    const team = teamOf(p.teamId);
    const missing = waitsOnPlayer(p, userTeamId);
    return {
      id: p._id,
      period: p.period,
      clock: p.clock,
      team,
      description: describe(p),
      printed: p.description,
      pat: p.pat,
      score: `${p.awayScore}-${p.homeScore}`,
      gameWinner: p._id === data.gameWinnerId,
      needsPlayer: missing,
      suggestion: missing ? (onlyScorer(rankedScorers(p, data, team.abbr))?.name ?? null) : null,
    };
  });
}

/** The margin over game time from the user's side. */
export function wormOf(data: ScoringData, userIsHome: boolean): WormPoint[] {
  return wormPoints(data.plays, userIsHome).map(({ seconds, margin, playIndex }) => {
    const play = playIndex === null ? undefined : data.plays[playIndex];
    return {
      seconds,
      margin,
      play: play
        ? { when: playWhen(play), what: describe(play), score: `${play.awayScore}-${play.homeScore}` }
        : null,
    };
  });
}

/** Where each period of the game falls on its clock. */
export function wormPeriods(data: ScoringData) {
  const count = Math.max(4, ...data.plays.map((p) => p.period));
  return Array.from({ length: count }, (_, i) => ({ start: gameLength(i), end: gameLength(i + 1) }));
}

export const wormPeriodLabel = (index: number) => {
  const label = periodLabel(index);
  return index < 4 ? `Q${label}` : label;
};

export const playersMissing = (data: ScoringData, userTeamId: Id<"teams">) =>
  data.plays.filter((p) => waitsOnPlayer(p, userTeamId)).length;

/** "K. Boutte, 15 yd pass from D. Maye, Q4 2:14". */
export function gameWinnerLine(data: ScoringData): string | null {
  const play = data.plays.find((p) => p._id === data.gameWinnerId);
  return play ? `${describe(play)}, ${playWhen(play)}` : null;
}
