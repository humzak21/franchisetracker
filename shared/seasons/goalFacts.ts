/**
 * The facts goals are judged on, gathered from what the season already stores: its games, the
 * user team's standing row and the season's record cache, and a player's log-derived totals. Pure.
 */
import { isPlayoffRound, type PlayoffResult, type PlayoffRound, type SeasonStatus } from "../domain/calendar";
import { resultOf, seasonSummary, type GameLike } from "../games/summary";
import { aggregateLines } from "../stats/aggregate";
import type { StatLine } from "../stats/registry";
import type { PlayerFacts, TeamFacts } from "./goals";

type Placing = { divisionRank?: number; seed?: number; playoffResult?: PlayoffResult };

export function teamGoalFacts(
  season: { year: number; status: SeasonStatus; userRecord?: Placing },
  games: readonly GameLike[],
  standing: Placing | null,
): TeamFacts {
  const playoffGames = games.flatMap((g) => {
    const result = resultOf(g);
    return isPlayoffRound(g.weekKey) && result !== null
      ? [{ round: g.weekKey as PlayoffRound, won: result === "W" }]
      : [];
  });
  return {
    year: season.year,
    status: season.status,
    regular: seasonSummary(games).regular,
    // A captured standings screen is newer than the record cache, as on Home.
    divisionRank: standing?.divisionRank ?? season.userRecord?.divisionRank ?? null,
    seed: standing?.seed ?? season.userRecord?.seed ?? null,
    playoffResult: season.userRecord?.playoffResult ?? standing?.playoffResult ?? null,
    playoffGames,
    bye: games.some((g) => g.weekKey === "wc" && g.status === "bye"),
  };
}

/**
 * A player's regular-season totals from his log-derived season rows (one per team he played
 * for), or null when there are none. Imported rows are real NFL history, not this franchise.
 */
export function playerGoalFacts(
  rows: readonly { split: string; source: string; gamesPlayed: number; totals: StatLine }[],
): PlayerFacts {
  const own = rows.filter((r) => r.split === "regular" && r.source === "logs");
  if (own.length === 0) return null;
  return {
    totals: aggregateLines(own.map((r) => r.totals)),
    games: own.reduce((sum, r) => sum + r.gamesPlayed, 0),
  };
}
