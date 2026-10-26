/**
 * Season and career aggregates from per-game lines: the shape `seasonPlayerStats` and
 * `careerPlayerStats` materialize. Game logs are the source of truth (FEATURES.md principle 1).
 */
import { aggregateLines, computeDerived } from "./aggregate";
import { RAW_STATS, type RawStatKey, type StatLine } from "./registry";
import { gameHighlights } from "./thresholds";

export type StatMap = Record<string, number>;

export type GamesSummary = {
  gamesPlayed: number;
  totals: StatLine;
  /** Derived stats and per-game rates; nulls (no attempts) are left out. */
  averages: StatMap;
  /** Threshold games met, keyed by `GAME_THRESHOLDS` key. */
  thresholdCounts: StatMap;
  /** Best single game per summed raw stat. */
  bests: StatMap;
};

function rates(totals: StatLine, games: number): StatMap {
  const averages: StatMap = {};
  for (const [key, value] of Object.entries(computeDerived(totals, { games }))) {
    if (value !== null) averages[key] = value;
  }
  return averages;
}

export function summarizeGames(lines: readonly StatLine[]): GamesSummary {
  const totals = aggregateLines(lines);
  const averages = rates(totals, lines.length);
  const thresholdCounts: StatMap = {};
  const bests: StatMap = {};
  for (const line of lines) {
    for (const t of gameHighlights(line)) thresholdCounts[t.key] = (thresholdCounts[t.key] ?? 0) + 1;
    for (const key of Object.keys(line) as RawStatKey[]) {
      const value = line[key];
      if (value === undefined || RAW_STATS[key].aggregation !== "sum") continue;
      bests[key] = Math.max(bests[key] ?? value, value);
    }
  }
  return { gamesPlayed: lines.length, totals, averages, thresholdCounts, bests };
}

/** Career aggregate from season aggregates: totals and counts add up, bests keep the maximum. */
export function summarizeSeasons(seasons: readonly Omit<GamesSummary, "averages">[]): GamesSummary {
  const gamesPlayed = seasons.reduce((n, s) => n + s.gamesPlayed, 0);
  const totals = aggregateLines(seasons.map((s) => s.totals));
  const thresholdCounts: StatMap = {};
  const bests: StatMap = {};
  for (const season of seasons) {
    for (const [k, v] of Object.entries(season.thresholdCounts))
      thresholdCounts[k] = (thresholdCounts[k] ?? 0) + v;
    for (const [k, v] of Object.entries(season.bests)) bests[k] = Math.max(bests[k] ?? v, v);
  }
  return { gamesPlayed, totals, averages: rates(totals, gamesPlayed), thresholdCounts, bests };
}

type SourcedRow = { year: number; teamKey: string; source: "logs" | "import" };

/**
 * One row per season and team: totals derived from game logs replace imported totals for the
 * same season, so a season that was imported and then captured is never counted twice.
 */
export function preferLogs<T extends SourcedRow>(rows: readonly T[]): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.year}-${row.teamKey}`;
    const existing = byKey.get(key);
    if (!existing || (existing.source === "import" && row.source === "logs")) byKey.set(key, row);
  }
  return [...byKey.values()];
}
