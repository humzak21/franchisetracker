/**
 * Season highs: a player's best single game per stat, with the game it came in, materialized on
 * each season row so the season table can link every high to its box score.
 */
import { weekIndex, type WeekKey } from "../domain/calendar";
import { RECORD_STATS, TOP_GAMES } from "./records";
import type { StatLine } from "./registry";
import { SEASON_HIGH_STATS, singleGameValue } from "./singleGame";

export type SeasonHigh<G> = { value: number; gameId: G; weekKey: WeekKey };
export type PlayedGame<G> = { gameId: G; weekKey: WeekKey; line: StatLine };

/**
 * Best qualifying game per stat. A tie goes to the earliest week, the game that first set the
 * mark. Zeros are not highs, so a lineman with no sacks has no sack high.
 */
export function seasonHighs<G>(games: readonly PlayedGame<G>[]): Record<string, SeasonHigh<G>> {
  const ordered = [...games].sort((a, b) => weekIndex(a.weekKey) - weekIndex(b.weekKey));
  const highs: Record<string, SeasonHigh<G>> = {};
  for (const game of ordered) {
    for (const stat of SEASON_HIGH_STATS) {
      const value = singleGameValue(stat, game.line);
      if (value === null || value <= 0) continue;
      const best = highs[stat];
      if (!best || value > best.value) highs[stat] = { value, gameId: game.gameId, weekKey: game.weekKey };
    }
  }
  return highs;
}

/**
 * The best games per record stat, so a single-game list can hold a player's second and third
 * best too. A tie stays with the earlier game, and zeros are not games to remember.
 */
export function topGames<G>(games: readonly PlayedGame<G>[]): Record<string, SeasonHigh<G>[]> {
  const ordered = [...games].sort((a, b) => weekIndex(a.weekKey) - weekIndex(b.weekKey));
  const top: Record<string, SeasonHigh<G>[]> = {};
  for (const stat of RECORD_STATS) {
    const best = ordered
      .flatMap(({ gameId, weekKey, line }) => {
        const value = line[stat] ?? 0;
        return value > 0 ? [{ value, gameId, weekKey }] : [];
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_GAMES);
    if (best.length > 0) top[stat] = best;
  }
  return top;
}
