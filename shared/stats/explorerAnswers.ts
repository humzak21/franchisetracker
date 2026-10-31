/**
 * Answers to an explorer question (`explorer.ts`), worked out from game lines or season rows.
 * Every answer ranks the same way: most first, or fewest games first for a mark, level rows sharing
 * a rank, and a player with nothing to count left off.
 */
import { aggregateLines, statValue } from "./aggregate";
import { EXPLORER_LIMIT, type Question } from "./explorer";
import { type LoggedGame } from "./ledger";
import { MARK_STATS, reachedMarks, type MarkStat } from "./marks";
import { sharedRanks } from "./recordBoards";
import type { StatKey, StatLine } from "./registry";
import { bestSpans } from "./spans";
import { splitTest, type SplitGame } from "./splits";
import { streakPointLabel, streakSpanLabel } from "./streaks";

export type ExplorerRow = {
  key: string;
  playerId: string;
  value: number;
  /** Games behind the number, where that means anything. */
  games: number | null;
  when: string | null;
  gameId: string | null;
};

export type ExplorerAnswer = { total: number; rows: (ExplorerRow & { rank: number })[] };

export type ExplorerLine = LoggedGame & { playerId: string };

export type SeasonFigure = { playerId: string; year: number; gamesPlayed: number; totals: StatLine };

/** Ranks rows already in order and keeps the first `EXPLORER_LIMIT`. */
export function rankAnswer(sorted: readonly ExplorerRow[]): ExplorerAnswer {
  return { total: sorted.length, rows: sharedRanks(sorted.slice(0, EXPLORER_LIMIT), (r) => r.value) };
}

const most = (rows: readonly ExplorerRow[]) => [...rows].sort((a, b) => b.value - a.value);

const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  return [...groups.entries()];
};

const yearsLabel = (years: readonly number[]) => {
  const [first, last] = [Math.min(...years), Math.max(...years)];
  return first === last ? String(first) : `${first} to ${last}`;
};

/** Season and career rows: one per player and year, or one per player. */
function aggregateRows(q: Question, figures: readonly SeasonFigure[]) {
  const season = q.scope === "season";
  const groups = groupBy(figures, (f) => (season ? `${f.playerId}-${f.year}` : f.playerId));
  return most(
    groups.flatMap(([key, group]) => {
      const games = group.reduce((n, f) => n + f.gamesPlayed, 0);
      const totals = aggregateLines(group.map((f) => f.totals));
      const value = statValue(q.statKey, totals, { games }) ?? 0;
      const [first] = group;
      if (!first || value <= 0 || games < q.minGames) return [];
      const when = yearsLabel(group.map((f) => f.year));
      return [{ key, playerId: first.playerId, value, games, when, gameId: null }];
    }),
  );
}

export const answerFromSeasons = (q: Question, figures: readonly SeasonFigure[]) =>
  rankAnswer(aggregateRows(q, figures));

const gameRows = (q: Question, lines: readonly ExplorerLine[]) =>
  most(
    lines.flatMap((l) => {
      const value = statValue(q.statKey, l.stats) ?? 0;
      if (value <= 0) return [];
      return [
        {
          key: `${l.playerId}-${l.gameId}`,
          playerId: l.playerId,
          value,
          games: null,
          when: streakPointLabel(l),
          gameId: l.gameId,
        },
      ];
    }),
  );

const spanRows = (q: Question, stat: MarkStat, lines: readonly ExplorerLine[]) =>
  most(
    groupBy(lines, (l) => l.playerId).flatMap(([playerId, own]) => {
      const { best } = bestSpans(own, stat, q.window);
      if (!best) return [];
      return [
        {
          key: playerId,
          playerId,
          value: best.value,
          games: q.window,
          when: streakSpanLabel(best.start, best.end),
          gameId: best.start.gameId,
        },
      ];
    }),
  );

/** Within the games asked about, each player's run to the mark; `season` counts each year afresh. */
const markRows = (q: Question, stat: MarkStat, lines: readonly ExplorerLine[]) =>
  groupBy(lines, (l) => (q.horizon === "season" ? `${l.playerId}-${l.year}` : l.playerId))
    .flatMap(([key, own]) => {
      const [first] = own;
      const hit = reachedMarks(own, stat).find((m) => m.mark === q.mark);
      const game = own.find((l) => l.gameId === hit?.gameId);
      if (!first || !hit || !game) return [];
      return [
        {
          key,
          playerId: first.playerId,
          value: hit.gamesToReach,
          games: hit.gamesToReach,
          when: streakPointLabel(game),
          gameId: hit.gameId,
        },
      ];
    })
    .sort((a, b) => a.value - b.value);

const isMarkStat = (key: StatKey): key is MarkStat => (MARK_STATS as readonly StatKey[]).includes(key);

/** Fold over game lines, already narrowed to the seasons, position and player asked about. */
export function answerFromLines(
  q: Question,
  lines: readonly ExplorerLine[],
  games: ReadonlyMap<string, SplitGame>,
): ExplorerAnswer {
  const test = splitTest(q.split);
  const kept = lines.filter((l) => {
    const game = games.get(l.gameId);
    return game !== undefined && test !== null && test(game);
  });
  if (q.scope === "game") return rankAnswer(gameRows(q, kept));
  if (q.scope === "span") return rankAnswer(isMarkStat(q.statKey) ? spanRows(q, q.statKey, kept) : []);
  if (q.scope === "mark") return rankAnswer(isMarkStat(q.statKey) ? markRows(q, q.statKey, kept) : []);
  const figures = groupBy(kept, (l) => `${l.playerId}-${l.year}`).flatMap(([, group]) => {
    const [first] = group;
    return first
      ? [
          {
            playerId: first.playerId,
            year: first.year,
            gamesPlayed: group.length,
            totals: aggregateLines(group.map((l) => l.stats)),
          },
        ]
      : [];
  });
  return rankAnswer(aggregateRows(q, figures));
}
