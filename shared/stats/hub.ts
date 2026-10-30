/**
 * The pieces the hub's views share (`docs/STATS-HUB.md` 3): what a season is on pace for, who leads
 * it, and which marks the roster is closing in on. Pure; every number is worked out on read.
 */
import { weekPhase, type SeasonStatus, type WeekKey } from "../domain";
import type { WLT } from "../games/summary";
import { formatRecord } from "./format";
import { loggedValue } from "./ledger";
import { MARK_STATS, MARKS, type MarkStat } from "./marks";
import { paceTargets, seasonPace, teamPace, type PaceCheck } from "./pace";
import { isRawStatKey, RAW_STATS, type StatKey, type StatLine } from "./registry";

/** A pace means something once a season has started and until it has finished. */
export const seasonInProgress = (status: SeasonStatus, played: number, gamesPerSeason: number) =>
  status === "regular" && played > 0 && played < gamesPerSeason;

/** A projected record in whole games that adds up to the season. */
export function paceRecord(record: WLT, gamesPerSeason: number): WLT | null {
  const pace = teamPace(
    { wins: record.w, losses: record.l, ties: record.t, pointsFor: 0, pointsAgainst: 0 },
    gamesPerSeason,
  );
  if (!pace) return null;
  const w = Math.round(pace.wins);
  const t = Math.round(pace.ties);
  return { w, l: Math.max(0, gamesPerSeason - w - t), t };
}

/** "On pace for 12-5, 410 points"; null when there is no season to project. */
export function paceLine(
  record: WLT,
  pointsFor: number,
  status: SeasonStatus,
  gamesPerSeason: number,
): string | null {
  const played = record.w + record.l + record.t;
  const projected = paceRecord(record, gamesPerSeason);
  if (!projected || !seasonInProgress(status, played, gamesPerSeason)) return null;
  const points = Math.round(seasonPace(pointsFor, played, gamesPerSeason) ?? 0);
  return `On pace for ${formatRecord(projected)}, ${points} points`;
}

export type Scored = { weekKey: WeekKey; pointsFor: number; pointsAgainst: number };

/** Regular-season points: what a pace or a Pythagorean record counts. */
export function regularPoints(games: readonly Scored[]): { pointsFor: number; pointsAgainst: number } {
  const regular = games.filter((g) => weekPhase(g.weekKey) === "regular");
  return {
    pointsFor: regular.reduce((n, g) => n + g.pointsFor, 0),
    pointsAgainst: regular.reduce((n, g) => n + g.pointsAgainst, 0),
  };
}

/**
 * A player's season total if they play every game left at their rate. Counted from the team's
 * games rather than the player's, so a player who sat out three is not projected to play 17.
 */
export function playerPace(
  total: number,
  playerGames: number,
  teamGames: number,
  gamesPerSeason: number,
): number | null {
  if (playerGames === 0) return null;
  return total + (total / playerGames) * Math.max(0, gamesPerSeason - teamGames);
}

/** A season line projected whole: counts scale, and a longest play stays what it is. */
export function projectedLine(
  line: StatLine,
  playerGames: number,
  teamGames: number,
  gamesPerSeason: number,
): StatLine {
  const projected: StatLine = {};
  for (const [key, value] of Object.entries(line)) {
    if (!isRawStatKey(key) || value === undefined) continue;
    projected[key] =
      RAW_STATS[key].aggregation === "max"
        ? value
        : Math.round(playerPace(value, playerGames, teamGames, gamesPerSeason) ?? value);
  }
  return projected;
}

/** The games a player would finish on. */
export const projectedGames = (playerGames: number, teamGames: number, gamesPerSeason: number) =>
  playerGames + Math.max(0, gamesPerSeason - teamGames);

export const PACE_GOAL_LABELS = {
  lastSeason: "last season",
  best: "career best",
  mark: "next mark",
  record: "franchise record",
} as const;
export type PaceGoal = keyof typeof PACE_GOAL_LABELS;

type PaceInput = {
  gamesPerSeason: number;
  live: { year: number; teamGames: number } | null;
  seasons: readonly { year: number; gamesPlayed: number; totals: StatLine }[];
  records: readonly { statKey: string; value: number }[];
};

/** Season marks are the career list's first rungs; a single season tops out far below the last. */
const seasonMark = (stat: StatKey, total: number) =>
  stat in MARKS ? nextMark(stat as MarkStat, total) : null;

/**
 * What a live season is chasing, stat by stat: last season, the career best, the next mark and the
 * franchise record, nearest first, leaving out anything already passed or never reachable. The
 * projection counts the team's games left, as `playerPace` does.
 */
export function paceGoals(
  { gamesPerSeason, live, seasons, records }: PaceInput,
  stats: readonly StatKey[],
): { stat: StatKey; total: number; checks: PaceCheck<PaceGoal>[] }[] {
  const now = seasons.find((s) => s.year === live?.year);
  if (!live || !now || now.gamesPlayed === 0) return [];
  const earlier = seasons.filter((s) => s.year < live.year);
  const finishGames = projectedGames(now.gamesPlayed, live.teamGames, gamesPerSeason);
  return stats.flatMap((stat) => {
    const total = loggedValue(stat, now.totals);
    if (total <= 0) return [];
    const previous = earlier.at(-1);
    const best = Math.max(0, ...earlier.map((s) => loggedValue(stat, s.totals)));
    const record = records.find((r) => r.statKey === stat)?.value;
    const mark = seasonMark(stat, total);
    const goals: { key: PaceGoal; target: number | null | undefined }[] = [
      { key: "lastSeason", target: previous ? loggedValue(stat, previous.totals) : null },
      { key: "best", target: best },
      { key: "mark", target: mark },
      { key: "record", target: record },
    ];
    const open = goals.flatMap(({ key, target }) =>
      typeof target === "number" && target > total ? [{ key, target }] : [],
    );
    const unique = [...new Map(open.map((g) => [g.target, g])).values()].sort((a, b) => a.target - b.target);
    const checks = paceTargets(total, now.gamesPlayed, finishGames, unique);
    return checks.length > 0 ? [{ stat, total, checks }] : [];
  });
}

/** The three lines the Overview leads with: the passer, the playmaker and the defender. */
export const LEADER_SLOTS = [
  { key: "passing", label: "Passing yards", stat: "passYds" },
  { key: "scrimmage", label: "Yards from scrimmage", stat: "scrimmageYds" },
  { key: "defense", label: "Tackles", stat: "tackles" },
] as const satisfies readonly { key: string; label: string; stat: StatKey }[];

export type LeaderSlot = (typeof LEADER_SLOTS)[number]["key"];

/** Who leads each slot; a slot nobody has a number in is left out. */
export function seasonLeaders<R extends { totals: StatLine }>(rows: readonly R[]) {
  return LEADER_SLOTS.flatMap((slot) => {
    const best = rows.reduce<{ row: R; value: number } | null>((top, row) => {
      const value = loggedValue(slot.stat, row.totals);
      return value > (top?.value ?? 0) ? { row, value } : top;
    }, null);
    return best ? [{ ...slot, ...best }] : [];
  });
}

/** The next mark above a total, or null past the last one. */
export const nextMark = (stat: MarkStat, total: number): number | null =>
  MARKS[stat].find((mark) => mark > total) ?? null;

export type CountdownPlayer<I extends string = string> = { id: I; games: number; totals: StatLine };

export type Countdown<I extends string = string> = {
  id: I;
  statKey: MarkStat;
  mark: number;
  value: number;
  remaining: number;
  /** Games away at the player's career rate. */
  gamesAway: number;
};

/**
 * Each player's nearest career mark within `maxGames` at their own rate, nearest first. Ranked in
 * games, not yards: 90 yards is two games for a starter and a season for a fullback. One per
 * player, or a running back's rushing and scrimmage yards would fill the list by themselves.
 */
export function countdowns<I extends string>(
  players: readonly CountdownPlayer<I>[],
  maxGames: number,
): Countdown<I>[] {
  const nearest = players.flatMap((player) => {
    if (player.games === 0) return [];
    const options = MARK_STATS.flatMap((statKey): Countdown<I>[] => {
      const value = loggedValue(statKey, player.totals);
      const mark = nextMark(statKey, value);
      if (value <= 0 || mark === null) return [];
      const remaining = mark - value;
      const gamesAway = Math.ceil(remaining / (value / player.games));
      return gamesAway <= maxGames ? [{ id: player.id, statKey, mark, value, remaining, gamesAway }] : [];
    });
    const [first] = options.sort(byNearest);
    return first ? [first] : [];
  });
  return nearest.sort(byNearest);
}

const byNearest = (a: Countdown, b: Countdown) =>
  a.gamesAway - b.gamesAway || a.remaining / a.mark - b.remaining / b.mark;
