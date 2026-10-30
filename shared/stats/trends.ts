/**
 * A career as curves (`docs/STATS-HUB.md` 4.5 and 7): which stats to chart, each season's running
 * total laid over the others, a record's pace, and a rolling average. Pure.
 */
import { weekLabel, weekPhase } from "../domain";
import { inCareerOrder, loggedValue, runningTotals, type LoggedGame } from "./ledger";
import { MARK_STATS } from "./marks";
import { RECORD_STATS } from "./records";
import { RAW_STATS, STAT_KEYS, type StatKey } from "./registry";
import type { SeasonFigures } from "./yoy";

/** Stats that add up: the ones a season-to-season line or a running total can show. */
const SUMMED: readonly StatKey[] = [
  ...new Set<StatKey>([...MARK_STATS, ...RECORD_STATS.filter((k) => RAW_STATS[k].aggregation === "sum")]),
];

/** Summed stats this player has a number in, in registry order. */
export function trendStats(seasons: readonly SeasonFigures[]): StatKey[] {
  return SUMMED.filter((stat) => seasons.some((s) => loggedValue(stat, s.totals) !== 0)).sort(
    (a, b) => STAT_KEYS.indexOf(a) - STAT_KEYS.indexOf(b),
  );
}

export type SeasonCurve = { year: number; points: { game: number; total: number }[] };

/** One running total per season, regular season only, each from its own game 1. */
export function seasonCurves(games: readonly LoggedGame[], stat: StatKey): SeasonCurve[] {
  const regular = games.filter((g) => weekPhase(g.weekKey) === "regular");
  const years = [...new Set(regular.map((g) => g.year))].sort((a, b) => a - b);
  return years.map((year) => ({
    year,
    points: runningTotals(
      regular.filter((g) => g.year === year),
      stat,
    ).map((r) => ({ game: r.seasonGame, total: r.total })),
  }));
}

/** The team's running points, one curve per season. */
export function pointsCurves(
  seasons: readonly { year: number; games: readonly { pointsFor: number }[] }[],
): SeasonCurve[] {
  return seasons.map(({ year, games }) => {
    let total = 0;
    return {
      year,
      points: games.map((game, i) => {
        total += game.pointsFor;
        return { game: i + 1, total };
      }),
    };
  });
}

export type CurveKey = "latest" | "previous" | "best";
export type ChosenCurve = SeasonCurve & { key: CurveKey };

/** The curves worth laying over each other: the latest season, the one before, and the best. */
export function chosenCurves(curves: readonly SeasonCurve[]): ChosenCurve[] {
  const finish = (c: SeasonCurve) => c.points.at(-1)?.total ?? 0;
  const latest = curves.at(-1);
  if (!latest) return [];
  const previous = curves.at(-2);
  const best = [...curves].sort((a, b) => finish(b) - finish(a) || a.year - b.year)[0];
  const picks: ChosenCurve[] = [{ ...latest, key: "latest" }];
  if (previous) picks.push({ ...previous, key: "previous" });
  if (best && best.year !== latest.year && best.year !== previous?.year) picks.push({ ...best, key: "best" });
  return picks;
}

/** A straight line to a season record: where a season must be each game to match it. */
export function recordPace(value: number, gamesPerSeason: number): { game: number; total: number }[] {
  return Array.from({ length: gamesPerSeason }, (_, i) => ({
    game: i + 1,
    total: (value / gamesPerSeason) * (i + 1),
  }));
}

export type RollingPoint = { key: string; label: string; group: string; value: number };

export const ROLLING_WINDOW = 5;

/** The average over each game and the `window - 1` before it, once there are that many. */
export function rollingAverage(
  games: readonly LoggedGame[],
  stat: StatKey,
  window: number = ROLLING_WINDOW,
): RollingPoint[] {
  const ordered = inCareerOrder(games);
  return ordered.flatMap((game, i) => {
    if (i < window - 1) return [];
    const span = ordered.slice(i - window + 1, i + 1);
    const sum = span.reduce((n, g) => n + loggedValue(stat, g.stats), 0);
    return [
      {
        key: game.gameId,
        label: `${game.year} · ${weekLabel(game.weekKey, "long")}`,
        group: String(game.year),
        value: Math.round((sum / window) * 10) / 10,
      },
    ];
  });
}
