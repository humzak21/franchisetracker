/**
 * The best N consecutive games (`docs/STATS-HUB.md` 4.3), over the games a player appeared in: a
 * game without a line is not a game for him, so a DNP does not break a span. Boards keep each
 * player's best and his next best that does not overlap it.
 */
import type { WeekKey } from "../domain/calendar";
import { inCareerOrder, loggedValue, type LoggedGame } from "./ledger";
import { MARK_STATS, type MarkStat } from "./marks";
import { BOARD_SIZE } from "./recordBoards";

export const SPAN_WINDOWS = [2, 3, 4, 5, 8, 10] as const;
export type SpanWindow = (typeof SPAN_WINDOWS)[number];
export const SPAN_STATS: readonly MarkStat[] = MARK_STATS;

export type Span<L> = { value: number; start: L; end: L; crossesSeasons: boolean };

type Found<L> = Span<L> & { from: number };

/** The best window, and the best one left that shares no game with it. Ties go to the earliest. */
export function bestSpans<L extends LoggedGame>(
  lines: readonly L[],
  stat: MarkStat,
  window: number,
): { best: Span<L> | null; second: Span<L> | null } {
  const ordered = inCareerOrder(lines);
  const windows: Found<L>[] = [];
  let sum = 0;
  ordered.forEach((line, i) => {
    sum += loggedValue(stat, line.stats);
    const out = ordered[i - window];
    if (out) sum -= loggedValue(stat, out.stats);
    const start = ordered[i - window + 1];
    if (start && sum > 0) {
      windows.push({
        value: sum,
        start,
        end: line,
        crossesSeasons: start.seasonId !== line.seasonId,
        from: i - window + 1,
      });
    }
  });
  const top = (rows: Found<L>[]) =>
    rows.reduce<Found<L> | null>((a, r) => (!a || r.value > a.value ? r : a), null);
  const best = top(windows);
  if (!best) return { best: null, second: null };
  const second = top(windows.filter((w) => Math.abs(w.from - best.from) >= window));
  const strip = ({ from: _from, ...span }: Found<L>): Span<L> => span;
  return { best: strip(best), second: second ? strip(second) : null };
}

export type SpanEntry<P extends string = string, G extends string = string> = {
  playerId: P;
  value: number;
  startGameId: G;
  endGameId: G;
  startYear: number;
  startWeek: WeekKey;
  endYear: number;
  endWeek: WeekKey;
  crossesSeasons: boolean;
};

export function spanEntry<P extends string, G extends string, S extends string>(
  playerId: P,
  span: Span<LoggedGame<G, S>>,
): SpanEntry<P, G> {
  return {
    playerId,
    value: span.value,
    startGameId: span.start.gameId,
    endGameId: span.end.gameId,
    startYear: span.start.year,
    startWeek: span.start.weekKey,
    endYear: span.end.year,
    endWeek: span.end.weekKey,
    crossesSeasons: span.crossesSeasons,
  };
}

/** A board with these players' entries replaced, so a correction lowers them too. Best first. */
export function mergeSpanEntries<E extends SpanEntry>(
  current: readonly E[],
  players: ReadonlySet<string>,
  incoming: readonly E[],
  size: number = BOARD_SIZE,
): E[] {
  return [...current.filter((e) => !players.has(e.playerId)), ...incoming]
    .sort((a, b) => b.value - a.value || a.startYear - b.startYear)
    .slice(0, size);
}
