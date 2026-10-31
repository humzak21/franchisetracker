/**
 * "Fastest to": the game a player crossed each mark, over a career, a season or a stint with the
 * team (`docs/STATS-HUB.md` 4.2). Imported seasons have no games, so they count as a starting
 * total and a game count; a mark they already passed has no game to name and is left out.
 */
import { weekIndex, type WeekKey } from "../domain/calendar";
import { formatStat } from "./format";
import { loggedValue, runningTotals, type LoggedGame } from "./ledger";
import { sharedRanks } from "./recordBoards";
import { STAT_REGISTRY, type StatKey, type StatLine } from "./registry";

export const MARKS = {
  passYds: [1000, 5000, 10000, 20000, 30000, 40000, 50000],
  passTd: [10, 50, 100, 200, 300, 400],
  rushYds: [1000, 2000, 5000, 10000, 15000],
  rushTd: [10, 25, 50, 100],
  rec: [100, 250, 500, 1000],
  recYds: [1000, 2000, 5000, 10000, 15000],
  recTd: [10, 25, 50, 100],
  tackles: [100, 250, 500, 1000],
  sacks: [10, 25, 50, 100, 150, 200],
  defInt: [5, 10, 25, 50],
  fgm: [50, 100, 200, 300],
  scrimmageYds: [1000, 2000, 5000, 10000, 15000, 20000],
  scrimmageTd: [10, 25, 50, 100],
} as const satisfies Partial<Record<StatKey, readonly number[]>>;

export type MarkStat = keyof typeof MARKS;
export const MARK_STATS = Object.keys(MARKS) as MarkStat[];

export const MARK_HORIZONS = ["career", "season", "team"] as const;
export type MarkHorizon = (typeof MARK_HORIZONS)[number];

export const MARK_HORIZON_LABELS: Record<MarkHorizon, string> = {
  career: "Career",
  season: "Single season",
  team: "With the team",
};

/** What a count starts from: imported seasons before the logs begin. */
export type MarkStart = { totals: StatLine[]; games: number };
const NO_START: MarkStart = { totals: [], games: 0 };

export type ReachedMark<G extends string = string, S extends string = string> = {
  statKey: MarkStat;
  mark: number;
  gamesToReach: number;
  gameId: G;
  seasonId: S;
  weekKey: WeekKey;
};

/** Every mark of a stat these games crossed, on top of the starting total. */
export function reachedMarks<G extends string, S extends string>(
  lines: readonly LoggedGame<G, S>[],
  stat: MarkStat,
  start: MarkStart = NO_START,
): ReachedMark<G, S>[] {
  const base = start.totals.reduce((sum, line) => sum + loggedValue(stat, line), 0);
  const running = runningTotals(lines, stat);
  return MARKS[stat].flatMap((mark) => {
    if (base >= mark) return [];
    const hit = running.find((r) => base + r.total >= mark);
    return hit
      ? [
          {
            statKey: stat,
            mark,
            gamesToReach: start.games + hit.careerGame,
            gameId: hit.game.gameId,
            seasonId: hit.game.seasonId,
            weekKey: hit.game.weekKey,
          },
        ]
      : [];
  });
}

export type ImportedSeason<T extends string = string> = {
  teamId: T;
  gamesPlayed: number;
  totals: StatLine;
};

export type PlayerMark<G extends string = string, S extends string = string> = ReachedMark<G, S> & {
  horizon: MarkHorizon;
};

/**
 * Every mark of one player, every horizon. `lines` are the games with the user's team in the
 * regular season, the only ones with a complete log; `imported` are the real seasons before them.
 */
export function playerMarks<G extends string, S extends string, T extends string>(
  lines: readonly LoggedGame<G, S>[],
  imported: readonly ImportedSeason<T>[],
  userTeamId: T,
): PlayerMark<G, S>[] {
  const startOf = (seasons: readonly ImportedSeason<T>[]): MarkStart => ({
    totals: seasons.map((s) => s.totals),
    games: seasons.reduce((n, s) => n + s.gamesPlayed, 0),
  });
  const career = startOf(imported);
  const team = startOf(imported.filter((s) => s.teamId === userTeamId));
  const seasons = [...new Set(lines.map((l) => l.seasonId))];
  return MARK_STATS.flatMap((stat) => [
    ...reachedMarks(lines, stat, career).map((m) => ({ ...m, horizon: "career" as const })),
    ...reachedMarks(lines, stat, team).map((m) => ({ ...m, horizon: "team" as const })),
    ...seasons.flatMap((season) =>
      reachedMarks(
        lines.filter((l) => l.seasonId === season),
        stat,
      ).map((m) => ({ ...m, horizon: "season" as const })),
    ),
  ]);
}

/** One line per mark per game: a career mark says it all when the season's is the same one. */
export function distinctMarks<
  M extends Pick<PlayerMark, "statKey" | "mark" | "horizon"> & { gameId: string },
>(marks: readonly M[]): M[] {
  const order: MarkHorizon[] = ["career", "team", "season"];
  const best = new Map<string, M>();
  for (const horizon of order) {
    for (const m of marks) {
      const key = `${m.gameId}|${m.statKey}|${m.mark}`;
      if (m.horizon === horizon && !best.has(key)) best.set(key, m);
    }
  }
  return [...best.values()];
}

export const marksInGame = <M extends PlayerMark>(marks: readonly M[], gameId: string): M[] =>
  distinctMarks(marks.filter((m) => m.gameId === gameId));

/** "1,000 rushing yards". */
export function markLabel(m: Pick<PlayerMark, "statKey" | "mark">) {
  return `${formatStat(m.statKey, m.mark)} ${STAT_REGISTRY[m.statKey].label.toLowerCase()}`;
}

export function markTitle(name: string, m: Pick<PlayerMark, "statKey" | "mark" | "gamesToReach">) {
  return `${name}: ${markLabel(m)} in ${m.gamesToReach} games`;
}

/** A fastest-to list in order: fewest games first, then the earlier week. Level games share a rank. */
export function rankMarks<M extends { gamesToReach: number; weekKey: WeekKey; year: number }>(
  marks: readonly M[],
): (M & { rank: number })[] {
  const sorted = [...marks].sort(
    (a, b) =>
      a.gamesToReach - b.gamesToReach || weekIndex(a.weekKey) - weekIndex(b.weekKey) || a.year - b.year,
  );
  return sharedRanks(sorted, (m) => m.gamesToReach);
}
