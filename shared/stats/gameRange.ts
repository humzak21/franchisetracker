/** Narrowing a player's games to a season or a span of weeks, for the game-by-game chart. Pure. */

export type GameRange =
  | { kind: "all" }
  | { kind: "season"; year: number }
  /** From one game to another, by game key; either end may be in a different season. */
  | { kind: "span"; from: string; to: string };

type Ranged = { key: string; year: number };

/** The games inside a range, in their own order. A span given backwards still reads first to last. */
export function inRange<P extends Ranged>(points: readonly P[], range: GameRange): P[] {
  switch (range.kind) {
    case "all":
      return [...points];
    case "season":
      return points.filter((p) => p.year === range.year);
    case "span": {
      const at = (key: string, fallback: number) => {
        const i = points.findIndex((p) => p.key === key);
        return i === -1 ? fallback : i;
      };
      const a = at(range.from, 0);
      const b = at(range.to, points.length - 1);
      return points.slice(Math.min(a, b), Math.max(a, b) + 1);
    }
  }
}

/** The seasons that have a game, newest first. */
export function seasonsIn(points: readonly Ranged[]): number[] {
  return [...new Set(points.map((p) => p.year))].sort((a, b) => b - a);
}
