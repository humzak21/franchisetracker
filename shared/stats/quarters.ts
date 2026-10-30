/**
 * The team by quarter (`docs/STATS-HUB.md` 4.7): points for and against per period, and how games
 * turned. A game with scoring plays is read from them, which is exact; a game with only a line
 * score is read at the end of each quarter, so a lead lost inside a quarter goes unseen.
 */
import { REGULATION_QUARTERS, type LineScore } from "../games/lineScore";
import type { PlayMoment } from "../games/scoringPlay";
import { gameFlow, lineScoreFromPlays } from "./scoring";

export type QuarterGame = {
  userIsHome: boolean;
  lineScore: LineScore | null;
  /** Empty when the game's scoring summary was never captured. */
  plays: readonly PlayMoment[];
};

export type QuarterRow = { period: number; pointsFor: number; pointsAgainst: number; differential: number };

export type QuarterScoring = {
  games: number;
  periods: QuarterRow[];
  firstHalf: number;
  secondHalf: number;
};

const lineOf = (game: QuarterGame) =>
  game.plays.length > 0 ? lineScoreFromPlays(game.plays) : game.lineScore;

const sides = (game: QuarterGame, line: LineScore) =>
  game.userIsHome ? { us: line.home, them: line.away } : { us: line.away, them: line.home };

/** Totals per period across games with any quarters; overtime periods add rows. */
export function quarterScoring(games: readonly QuarterGame[]): QuarterScoring {
  const periods = new Map<number, QuarterRow>();
  let counted = 0;
  for (const game of games) {
    const line = lineOf(game);
    if (!line) continue;
    counted++;
    const { us, them } = sides(game, line);
    us.forEach((points, i) => {
      const row = periods.get(i + 1) ?? { period: i + 1, pointsFor: 0, pointsAgainst: 0, differential: 0 };
      row.pointsFor += points;
      row.pointsAgainst += them[i] ?? 0;
      row.differential = row.pointsFor - row.pointsAgainst;
      periods.set(i + 1, row);
    });
  }
  const rows = [...periods.values()].sort((a, b) => a.period - b.period);
  const half = (from: number, to: number) =>
    rows.filter((r) => r.period >= from && r.period <= to).reduce((n, r) => n + r.differential, 0);
  return { games: counted, periods: rows, firstHalf: half(1, 2), secondHalf: half(3, REGULATION_QUARTERS) };
}

export type GameTurn = {
  /** The most the user trailed by in a win. */
  comeback: number;
  /** The most the user led by in a loss. */
  blownLead: number;
};

/** How far a game swung from the user's side, by play where it can be, by quarter where not. */
export function gameTurn(game: QuarterGame): GameTurn {
  const home = game.userIsHome;
  if (game.plays.length > 0) {
    const flow = gameFlow(game.plays);
    const side = home ? "home" : "away";
    return {
      comeback: flow.winner === side ? flow.deficitOvercome : 0,
      blownLead: flow.winner !== null && flow.winner !== side ? flow.deficitOvercome : 0,
    };
  }
  if (!game.lineScore) return { comeback: 0, blownLead: 0 };
  const { us, them } = sides(game, game.lineScore);
  let lead = 0;
  let most = 0;
  let least = 0;
  us.forEach((points, i) => {
    lead += points - (them[i] ?? 0);
    most = Math.max(most, lead);
    least = Math.min(least, lead);
  });
  return { comeback: lead > 0 ? Math.abs(least) : 0, blownLead: lead < 0 ? most : 0 };
}
