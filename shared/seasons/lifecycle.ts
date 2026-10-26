/**
 * Season lifecycle (FEATURES.md 4.1): a season moves upcoming → regular → postseason → complete
 * as games are captured, and the Super Bowl week closes it. Pure; used by Convex and the UI.
 */
import {
  isPlayoffRound,
  PLAYOFF_ROUNDS,
  SEASON_STATUSES,
  weekPhase,
  type PlayoffResult,
  type PlayoffRound,
  type SeasonStatus,
} from "../domain/calendar";
import { resultOf, type GameLike } from "../games/summary";

export const SEASON_STATUS_LABELS: Record<SeasonStatus, string> = {
  upcoming: "Preseason",
  regular: "Regular season",
  postseason: "Playoffs",
  complete: "Complete",
};

const LOSS_RESULT: Record<PlayoffRound, PlayoffResult> = {
  wc: "wc_loss",
  div: "div_loss",
  conf: "conf_loss",
  sb: "sb_loss",
};

const rank = (status: SeasonStatus) => SEASON_STATUSES.indexOf(status);

/** The later of two statuses: a season never moves backwards when a game is corrected. */
export function laterStatus(a: SeasonStatus, b: SeasonStatus): SeasonStatus {
  return rank(a) >= rank(b) ? a : b;
}

/** Played playoff games, earliest round first. */
function playoffGames(games: readonly GameLike[]) {
  return games
    .filter((g) => isPlayoffRound(g.weekKey) && resultOf(g) !== null)
    .sort(
      (a, b) =>
        PLAYOFF_ROUNDS.indexOf(a.weekKey as PlayoffRound) - PLAYOFF_ROUNDS.indexOf(b.weekKey as PlayoffRound),
    );
}

/**
 * How far the season has got from its games: a regular-season result starts it, a playoff
 * game moves it to the postseason, and a played Super Bowl (Super Bowl week) completes it.
 */
export function statusFromGames(games: readonly GameLike[]): SeasonStatus {
  const played = games.filter((g) => resultOf(g) !== null);
  if (played.some((g) => g.weekKey === "sb")) return "complete";
  if (played.some((g) => weekPhase(g.weekKey) === "postseason")) return "postseason";
  if (played.some((g) => weekPhase(g.weekKey) === "regular")) return "regular";
  return "upcoming";
}

/**
 * Where the playoff run ended: the round of the first loss, the title for a Super Bowl win, or
 * undefined while the run is still going (or there was none).
 */
export function playoffResultFromGames(games: readonly GameLike[]): PlayoffResult | undefined {
  for (const game of playoffGames(games)) {
    const result = resultOf(game);
    if (result === "L") return LOSS_RESULT[game.weekKey as PlayoffRound];
    if (game.weekKey === "sb" && result === "W") return "champion";
  }
  return undefined;
}

/** True once the user team is out: a playoff loss. The league's Super Bowl may still be ahead. */
export function isEliminated(games: readonly GameLike[]): boolean {
  return playoffGames(games).some((g) => resultOf(g) === "L");
}

/** The playoff result to store when the owner marks the season finished by hand. */
export function finishedPlayoffResult(
  games: readonly GameLike[],
  current: PlayoffResult | undefined,
): PlayoffResult {
  return playoffResultFromGames(games) ?? current ?? "missed";
}

/** What the season card offers next: finish a season in progress, or advance past a finished one. */
export type SeasonAction = "finish" | "advance" | null;

export function nextSeasonAction(status: SeasonStatus, hasNextSeason: boolean): SeasonAction {
  if (status === "regular" || status === "postseason") return "finish";
  if (status === "complete" && !hasNextSeason) return "advance";
  return null;
}
