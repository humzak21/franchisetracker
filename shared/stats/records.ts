/**
 * Records books and all-time leaders (FEATURES.md 5.5). The franchise-era book ranks the user
 * team's log-derived season rows: the record is the top entry and the next nineteen stand behind
 * it. The team and all-time books (`recordBoards.ts`) rank the same way over more rows.
 */
import type { WeekKey } from "../domain/calendar";
import { aggregateLines } from "./aggregate";
import { RAW_STAT_KEYS, RAW_STATS, type RawStatKey, type StatLine } from "./registry";

export const RECORD_SCOPES = ["game", "season", "career"] as const;
export type RecordScope = (typeof RECORD_SCOPES)[number];

export const isRecordScope = (value: string): value is RecordScope =>
  (RECORD_SCOPES as readonly string[]).includes(value);

export const RECORD_SCOPE_LABELS: Record<RecordScope, string> = {
  game: "Single game",
  season: "Season",
  career: "Career",
};

/** Stats where more is better: the ones a record can be held in. */
export const RECORD_STATS: readonly RawStatKey[] = RAW_STAT_KEYS.filter(
  (k) => RAW_STATS[k].better === "higher",
);

/** Entries every records list shows. */
export const RECORD_TOP = 20;

/** Games a season row keeps per record stat: enough for a top twenty in practice. */
export const TOP_GAMES = 3;

/** One game on a single-game list. Rows from before `topGames` was kept name no game. */
export type GameEntry<G extends string = string> = { value: number; gameId?: G; weekKey?: WeekKey };

/** One player's season with the team: what `seasonPlayerStats` stores, plus the season's year. */
export type SeasonRow<P extends string = string, S extends string = string, G extends string = string> = {
  playerId: P;
  seasonId: S;
  year: number;
  totals: StatLine;
  /** Best single game per summed stat. */
  bests: Record<string, number>;
  /** The season's best games per record stat, best first. */
  topGames?: Record<string, readonly GameEntry<G>[]>;
};

export type RankEntry<
  P extends string = string,
  S extends string = string,
  G extends string = string,
> = GameEntry<G> & {
  playerId: P;
  /** The season it happened in (game and season scope) or the last season counted (career). */
  seasonId: S;
  year: number;
};

/** A single game's value for a stat: the best game for summed stats, the season figure for "longest" stats. */
export function gameValue(row: Pick<SeasonRow, "totals" | "bests">, stat: RawStatKey): number | undefined {
  return RAW_STATS[stat].aggregation === "max" ? row.totals[stat] : row.bests[stat];
}

/** A season's games on a stat's single-game list, best first; the plain best when no game was kept. */
export function gameEntries<G extends string>(
  row: Pick<SeasonRow<string, string, G>, "totals" | "bests" | "topGames">,
  stat: RawStatKey,
): GameEntry<G>[] {
  const listed = row.topGames?.[stat] ?? [];
  if (listed.length > 0) return [...listed].sort((a, b) => b.value - a.value).slice(0, TOP_GAMES);
  const value = gameValue(row, stat);
  return value ? [{ value }] : [];
}

/**
 * The top entries for a stat and scope, highest first. Ties go to whoever got there first, so
 * a record is only broken, never shared away. Game scope ranks each player-season's best games.
 */
export function rankStat<P extends string, S extends string, G extends string>(
  rows: readonly SeasonRow<P, S, G>[],
  stat: RawStatKey,
  scope: RecordScope,
  limit: number = RECORD_TOP,
): RankEntry<P, S, G>[] {
  let entries: RankEntry<P, S, G>[];
  if (scope === "career") {
    const byPlayer = new Map<P, SeasonRow<P, S>[]>();
    for (const row of rows) byPlayer.set(row.playerId, [...(byPlayer.get(row.playerId) ?? []), row]);
    entries = [...byPlayer.entries()].map(([playerId, seasons]) => {
      const last = seasons.reduce((a, b) => (b.year > a.year ? b : a));
      return {
        playerId,
        value: aggregateLines(seasons.map((s) => s.totals))[stat] ?? 0,
        seasonId: last.seasonId,
        year: last.year,
      };
    });
  } else if (scope === "game") {
    entries = rows.flatMap((row) =>
      gameEntries(row, stat).map((game) => ({
        playerId: row.playerId,
        seasonId: row.seasonId,
        year: row.year,
        ...game,
      })),
    );
  } else {
    entries = rows.map((row) => ({
      playerId: row.playerId,
      value: row.totals[stat] ?? 0,
      seasonId: row.seasonId,
      year: row.year,
    }));
  }
  return entries
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.year - b.year)
    .slice(0, limit);
}
