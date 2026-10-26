/**
 * Franchise records and all-time leaders (FEATURES.md 5.5), ranked from the user team's
 * log-derived season rows. One ranking serves both: the record is the top entry, the leaders
 * board is the top ten. Every number comes from game logs.
 */
import { aggregateLines } from "./aggregate";
import { RAW_STAT_KEYS, RAW_STATS, type RawStatKey, type StatLine } from "./registry";

export const RECORD_SCOPES = ["game", "season", "career"] as const;
export type RecordScope = (typeof RECORD_SCOPES)[number];

export const RECORD_SCOPE_LABELS: Record<RecordScope, string> = {
  game: "Single game",
  season: "Season",
  career: "Career",
};

/** Stats where more is better: the ones a record can be held in. */
export const RECORD_STATS: readonly RawStatKey[] = RAW_STAT_KEYS.filter(
  (k) => RAW_STATS[k].better === "higher",
);

export const LEADERS_LIMIT = 10;

/** One player's season with the team: what `seasonPlayerStats` stores, plus the season's year. */
export type SeasonRow<P extends string = string, S extends string = string> = {
  playerId: P;
  seasonId: S;
  year: number;
  totals: StatLine;
  /** Best single game per summed stat. */
  bests: Record<string, number>;
};

export type RankEntry<P extends string = string, S extends string = string> = {
  playerId: P;
  value: number;
  /** The season it happened in (game and season scope) or the last season counted (career). */
  seasonId: S;
  year: number;
};

/** A single game's value for a stat: the best game for summed stats, the season figure for "longest" stats. */
function gameValue(row: SeasonRow, stat: RawStatKey): number | undefined {
  return RAW_STATS[stat].aggregation === "max" ? row.totals[stat] : row.bests[stat];
}

/**
 * The top entries for a stat and scope, highest first. Ties go to whoever got there first, so
 * a record is only broken, never shared away. Game scope ranks each player-season's best game.
 */
export function rankStat<P extends string, S extends string>(
  rows: readonly SeasonRow<P, S>[],
  stat: RawStatKey,
  scope: RecordScope,
  limit: number = LEADERS_LIMIT,
): RankEntry<P, S>[] {
  let entries: RankEntry<P, S>[];
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
  } else {
    entries = rows.map((row) => ({
      playerId: row.playerId,
      value: (scope === "game" ? gameValue(row, stat) : row.totals[stat]) ?? 0,
      seasonId: row.seasonId,
      year: row.year,
    }));
  }
  return entries
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.year - b.year)
    .slice(0, limit);
}
