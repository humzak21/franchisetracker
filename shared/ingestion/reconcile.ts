/**
 * Reconciliation (Sprint 6): season totals a season stats screenshot printed against the totals
 * derived from captured game logs. Logs are the source of truth, so a difference is settled by
 * accepting the log number (the screen or the read was off) or by flagging a missing game. Pure.
 */
import { weekPhase, type WeekKey } from "../domain/calendar";

export const RECONCILE_RESOLUTIONS = ["logs", "missing"] as const;
export type Resolution = (typeof RECONCILE_RESOLUTIONS)[number];

/** `gamesPlayed` is reconciled like a stat. */
export const GAMES_KEY = "gamesPlayed";

export type ReportedTotals<P> = {
  playerId: P;
  gamesPlayed?: number;
  stats: Record<string, number>;
  resolved?: Partial<Record<string, Resolution>>;
};

export type LoggedTotals<P> = { playerId: P; gamesPlayed: number; totals: Record<string, number> };

export type Difference<P> = {
  playerId: P;
  stat: string;
  reported: number;
  logs: number;
  /** Reported minus logs: positive when the logs are short (a game may be missing). */
  delta: number;
  resolution: Resolution | null;
};

/** Half sacks and rounding on the screen: closer than this is the same number. */
const TOLERANCE = 0.05;

export function reconcile<P extends string>(
  reported: readonly ReportedTotals<P>[],
  logged: readonly LoggedTotals<P>[],
): { differences: Difference<P>[]; matched: number } {
  const logs = new Map(logged.map((l) => [l.playerId, l]));
  const differences: Difference<P>[] = [];
  let matched = 0;
  for (const row of reported) {
    const log = logs.get(row.playerId);
    const pairs: [string, number, number][] = Object.entries(row.stats).map(([stat, value]) => [
      stat,
      value,
      log?.totals[stat] ?? 0,
    ]);
    if (row.gamesPlayed !== undefined) pairs.unshift([GAMES_KEY, row.gamesPlayed, log?.gamesPlayed ?? 0]);
    for (const [stat, value, fromLogs] of pairs) {
      if (Math.abs(value - fromLogs) < TOLERANCE) {
        matched++;
        continue;
      }
      differences.push({
        playerId: row.playerId,
        stat,
        reported: value,
        logs: fromLogs,
        delta: value - fromLogs,
        resolution: row.resolved?.[stat] ?? null,
      });
    }
  }
  differences.sort(
    (a, b) =>
      Number(a.resolution !== null) - Number(b.resolution !== null) || Math.abs(b.delta) - Math.abs(a.delta),
  );
  return { differences, matched };
}

/** Regular-season and playoff weeks with a final score but no box score: where a missing game hides. */
export function weeksWithoutBoxScore(
  games: readonly { weekKey: WeekKey; status: string; hasBoxScore: boolean }[],
): WeekKey[] {
  return games
    .filter((g) => g.status === "played" && !g.hasBoxScore && weekPhase(g.weekKey) !== "preseason")
    .map((g) => g.weekKey);
}

/** How a screen labels a number `withMissingGames` took from the season screen. */
export const MISSING_GAME_NOTE = "From the season stats screen: a game's box score is missing";

/**
 * Regular-season totals as screens show them: wherever a difference was settled as a missing
 * game, the screen's number stands in for the logs'. Display only; stored totals, records and
 * the reconciliation itself keep reading the logs. `overridden` lists the stats replaced.
 */
export function withMissingGames(
  logged: { gamesPlayed: number; totals: Record<string, number> },
  reported: Omit<ReportedTotals<unknown>, "playerId"> | undefined,
): { gamesPlayed: number; totals: Record<string, number>; overridden: string[] } {
  let { gamesPlayed } = logged;
  const totals = { ...logged.totals };
  const overridden: string[] = [];
  for (const [stat, resolution] of Object.entries(reported?.resolved ?? {})) {
    if (resolution !== "missing" || !reported) continue;
    if (stat === GAMES_KEY) {
      if (reported.gamesPlayed === undefined) continue;
      gamesPlayed = reported.gamesPlayed;
    } else {
      const value = reported.stats[stat];
      if (value === undefined) continue;
      totals[stat] = value;
    }
    overridden.push(stat);
  }
  return { gamesPlayed, totals, overridden };
}
