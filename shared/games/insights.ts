/**
 * Season and rivalry insights from the user team's games (FEATURES.md 5.1, 5.2): points by week,
 * margins, the running streak and head-to-head lines per opponent. Pure; used by Convex and the UI.
 */
import { weekIndex, weekPhase, type GameResult, type WeekKey } from "../domain/calendar";
import { record, resultOf, userScore, type GameLike, type WLT } from "./summary";

/** A scored regular-season or playoff game: the only kind insights count. */
type Scored<T> = T & { us: number; them: number; result: GameResult };

function scored<T extends GameLike>(games: readonly T[]): Scored<T>[] {
  return games.flatMap((game) => {
    const score = userScore(game);
    const result = resultOf(game);
    if (!score || !result || !["regular", "postseason"].includes(weekPhase(game.weekKey))) return [];
    return [{ ...game, ...score, result }];
  });
}

/** Running streak after a result: +3 for three straight wins, -2 for two losses, 0 after a tie. */
function nextStreak(streak: number, result: GameResult): number {
  if (result === "T") return 0;
  return result === "W" ? Math.max(streak, 0) + 1 : Math.min(streak, 0) - 1;
}

export type WeekPoint = {
  weekKey: WeekKey;
  pointsFor: number;
  pointsAgainst: number;
  margin: number;
  result: GameResult;
  streak: number;
};

/** One point per counted game in week order: the season pulse, margin and streak charts read this. */
export function weekPoints(games: readonly GameLike[]): WeekPoint[] {
  let streak = 0;
  return scored(games)
    .sort((a, b) => weekIndex(a.weekKey) - weekIndex(b.weekKey))
    .map((game) => {
      streak = nextStreak(streak, game.result);
      return {
        weekKey: game.weekKey,
        pointsFor: game.us,
        pointsAgainst: game.them,
        margin: game.us - game.them,
        result: game.result,
        streak,
      };
    });
}

/** "W3", "L2" or "T1" for a running streak value. */
export function streakLabel(streak: number): string {
  return streak > 0 ? `W${streak}` : streak < 0 ? `L${-streak}` : "T1";
}

export type RivalryGame<T extends string> = GameLike & { opponentTeamId?: T; year: number };

export type Rivalry<T extends string> = {
  opponentTeamId: T;
  record: WLT;
  playoff: WLT;
  pointsFor: number;
  pointsAgainst: number;
  /** Current streak against this opponent ("W2"). */
  streak: string;
  last: { year: number; weekKey: WeekKey; us: number; them: number; result: GameResult };
  /** Meeting margins, oldest first. */
  margins: number[];
};

const meetings = (r: WLT) => r.w + r.l + r.t;

/** Head-to-head lines against every opponent met, most meetings first, then most recent. */
export function rivalries<T extends string>(games: readonly RivalryGame<T>[]): Rivalry<T>[] {
  const byOpponent = new Map<T, Scored<RivalryGame<T>>[]>();
  const chronological = scored(games).sort(
    (a, b) => a.year - b.year || weekIndex(a.weekKey) - weekIndex(b.weekKey),
  );
  for (const game of chronological) {
    if (!game.opponentTeamId) continue;
    byOpponent.set(game.opponentTeamId, [...(byOpponent.get(game.opponentTeamId) ?? []), game]);
  }
  const out: Rivalry<T>[] = [];
  for (const [opponentTeamId, played] of byOpponent) {
    const last = played[played.length - 1];
    if (!last) continue;
    out.push({
      opponentTeamId,
      record: record(played),
      playoff: record(played.filter((g) => weekPhase(g.weekKey) === "postseason")),
      pointsFor: played.reduce((sum, g) => sum + g.us, 0),
      pointsAgainst: played.reduce((sum, g) => sum + g.them, 0),
      streak: streakLabel(played.reduce((s, g) => nextStreak(s, g.result), 0)),
      last: { year: last.year, weekKey: last.weekKey, us: last.us, them: last.them, result: last.result },
      margins: played.map((g) => g.us - g.them),
    });
  }
  return out.sort(
    (a, b) =>
      meetings(b.record) - meetings(a.record) ||
      b.last.year - a.last.year ||
      weekIndex(b.last.weekKey) - weekIndex(a.last.weekKey),
  );
}
