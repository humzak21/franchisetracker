/** Running totals: a player's games in order and what each one brought the count to. Pure. */
import { weekIndex, type WeekKey } from "../domain/calendar";
import { statValue } from "./aggregate";
import type { StatKey, StatLine } from "./registry";

/** One game of a player's log, however it was read. */
export type LoggedGame<G extends string = string, S extends string = string> = {
  gameId: G;
  seasonId: S;
  year: number;
  weekKey: WeekKey;
  stats: StatLine;
};

export const inCareerOrder = <L extends Pick<LoggedGame, "year" | "weekKey">>(lines: readonly L[]): L[] =>
  [...lines].sort((a, b) => a.year - b.year || weekIndex(a.weekKey) - weekIndex(b.weekKey));

/** A stat's value for one game; a game without it counts zero rather than breaking a sum. */
export const loggedValue = (stat: StatKey, stats: StatLine) => statValue(stat, stats) ?? 0;

export type RunningTotal<L> = {
  game: L;
  /** This game's number in the career and within its season, from 1. */
  careerGame: number;
  seasonGame: number;
  total: number;
};

export function runningTotals<L extends LoggedGame>(lines: readonly L[], stat: StatKey): RunningTotal<L>[] {
  let total = 0;
  let season: string | null = null;
  let seasonGame = 0;
  return inCareerOrder(lines).map((game, i) => {
    total += loggedValue(stat, game.stats);
    seasonGame = game.seasonId === season ? seasonGame + 1 : 1;
    season = game.seasonId;
    return { game, careerGame: i + 1, seasonGame, total };
  });
}
