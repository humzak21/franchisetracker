/** Game and season arithmetic from the user team's point of view. Pure; used by Convex and the UI. */
import { weekIndex, weekPhase, type GameResult, type GameStatus, type WeekKey } from "../domain/calendar";

export type GameLike = {
  weekKey: WeekKey;
  status: GameStatus;
  userIsHome?: boolean;
  homeScore?: number;
  awayScore?: number;
};

export type WLT = { w: number; l: number; t: number };

export function sortByWeek<T extends { weekKey: WeekKey }>(games: readonly T[]): T[] {
  return [...games].sort((a, b) => weekIndex(a.weekKey) - weekIndex(b.weekKey));
}

/** The user's and opponent's scores, or null when the game has no final score. */
export function userScore(game: GameLike): { us: number; them: number } | null {
  if (game.status !== "played" || game.homeScore === undefined || game.awayScore === undefined) return null;
  return game.userIsHome
    ? { us: game.homeScore, them: game.awayScore }
    : { us: game.awayScore, them: game.homeScore };
}

export function resultOf(game: GameLike): GameResult | null {
  const score = userScore(game);
  if (!score) return null;
  return score.us > score.them ? "W" : score.us < score.them ? "L" : "T";
}

export function record(games: readonly GameLike[]): WLT {
  const out: WLT = { w: 0, l: 0, t: 0 };
  for (const game of games) {
    const result = resultOf(game);
    if (result === "W") out.w++;
    else if (result === "L") out.l++;
    else if (result === "T") out.t++;
  }
  return out;
}

/** Current streak, newest game first: "W3", "L1", or null before any result. */
export function streak(games: readonly GameLike[]): string | null {
  const results = sortByWeek(games)
    .map(resultOf)
    .filter((r): r is GameResult => r !== null)
    .reverse();
  const first = results[0];
  if (!first) return null;
  let count = 0;
  while (results[count] === first) count++;
  return `${first}${count}`;
}

export type SeasonSummary = {
  regular: WLT;
  postseason: WLT;
  pointsFor: number;
  pointsAgainst: number;
  streak: string | null;
};

/** Record splits, points and streak for one season's games. Preseason and Pro Bowl are ignored. */
export function seasonSummary(games: readonly GameLike[]): SeasonSummary {
  const counted = games.filter((g) => ["regular", "postseason"].includes(weekPhase(g.weekKey)));
  let pointsFor = 0;
  let pointsAgainst = 0;
  for (const game of counted) {
    const score = userScore(game);
    if (!score) continue;
    pointsFor += score.us;
    pointsAgainst += score.them;
  }
  return {
    regular: record(counted.filter((g) => weekPhase(g.weekKey) === "regular")),
    postseason: record(counted.filter((g) => weekPhase(g.weekKey) === "postseason")),
    pointsFor,
    pointsAgainst,
    streak: streak(counted),
  };
}

/** The user team's record entering a given week, from the season's earlier games. */
export function recordBefore(games: readonly GameLike[], week: WeekKey): WLT {
  return record(
    games.filter((g) => weekPhase(g.weekKey) !== "preseason" && weekIndex(g.weekKey) < weekIndex(week)),
  );
}
