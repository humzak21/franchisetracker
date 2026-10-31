/**
 * The team and all-time records books (FEATURES.md 5.5). Each list (book, split, scope, stat)
 * keeps its best entries, stored as a board and merged as new rows arrive, so no request ever
 * ranks every season of the league again. Typed entries (Bruce Smith, 200 sacks) join a list
 * when it is shown, replacing a computed entry for the same player. Pure.
 */
import type { WeekKey } from "../domain/calendar";
import { aggregateLines } from "./aggregate";
import { gameEntries, RECORD_STATS, RECORD_TOP, type GameEntry, type RecordScope } from "./records";
import type { RawStatKey, StatLine } from "./registry";

export const RECORD_BOOKS = ["team", "franchise", "league"] as const;
export type RecordBook = (typeof RECORD_BOOKS)[number];

export const RECORD_BOOK_LABELS: Record<RecordBook, string> = {
  team: "Team",
  franchise: "Franchise era",
  league: "All-time",
};

/** Books kept as boards and open to typed entries; the franchise-era book is the `records` table. */
export const BOARD_BOOKS = ["team", "league"] as const;
export type BoardBook = (typeof BOARD_BOOKS)[number];

/** Entries a board keeps: a few past what a list shows, so a typed entry or a correction leaves it full. */
export const BOARD_SIZE = 25;

export type BoardEntry<
  P extends string = string,
  S extends string = string,
  T extends string = string,
  G extends string = string,
> = {
  playerId: P;
  value: number;
  /** The season (game and season scope) or the last season counted (career). */
  year: number;
  seasonId?: S;
  teamId?: T;
  /** Career scope: the first season counted. */
  firstYear?: number;
  /** Game scope: which game, when the row kept it. */
  gameId?: G;
  weekKey?: WeekKey;
};

/** What one source says together: a player's career, or a player's season. */
const holderKey = (scope: RecordScope, e: BoardEntry) =>
  scope === "career" ? e.playerId : `${e.playerId}|${e.year}`;

/** A list's entries are one per holder, or up to `TOP_GAMES` per holder in game scope. */
const entryKey = (scope: RecordScope, e: BoardEntry) =>
  scope === "game" ? `${holderKey(scope, e)}|${e.weekKey ?? ""}` : holderKey(scope, e);

const byValue = (a: { value: number; year?: number }, b: { value: number; year?: number }) =>
  b.value - a.value || (a.year ?? 9999) - (b.year ?? 9999);

/**
 * A board with new entries merged in, best first. Incoming entries replace everything stored for
 * the same player (and season), even with a lower number, so a correction lands and a game that
 * dropped out of a season's best goes too.
 */
export function mergeEntries<E extends BoardEntry>(
  current: readonly E[],
  incoming: readonly E[],
  scope: RecordScope,
  size: number = BOARD_SIZE,
): E[] {
  const arriving = new Set(incoming.map((e) => holderKey(scope, e)));
  const byKey = new Map(
    current.filter((e) => !arriving.has(holderKey(scope, e))).map((e) => [entryKey(scope, e), e]),
  );
  for (const e of incoming) byKey.set(entryKey(scope, e), e);
  return [...byKey.values()]
    .filter((e) => e.value > 0)
    .sort(byValue)
    .slice(0, size);
}

/** One entry per player and season, the bigger number winning: two sources for one season. */
export function keepBest<E extends BoardEntry>(entries: readonly E[]): E[] {
  const best = new Map<string, E>();
  for (const e of entries) {
    const key = `${e.playerId}|${e.year}`;
    const prior = best.get(key);
    if (!prior || e.value > prior.value) best.set(key, e);
  }
  return [...best.values()];
}

export type StatRow<
  P extends string = string,
  S extends string = string,
  T extends string = string,
  G extends string = string,
> = {
  playerId: P;
  seasonId: S;
  year: number;
  teamId: T;
  gamesPlayed: number;
  totals: StatLine;
  bests: Record<string, number>;
  topGames?: Record<string, readonly GameEntry<G>[]>;
};

export type ScopeCandidates<E> = Record<"game" | "season", Map<RawStatKey, E[]>>;

/**
 * Season and single-game entries for every record stat. A player's rows for one season are
 * summed (a trade splits a season across teams) and shown with the team he played most for.
 */
export function seasonCandidates<P extends string, S extends string, T extends string, G extends string>(
  rows: readonly StatRow<P, S, T, G>[],
): ScopeCandidates<BoardEntry<P, S, T, G>> {
  const groups = new Map<string, StatRow<P, S, T, G>[]>();
  for (const row of rows) {
    const key = `${row.playerId}|${row.seasonId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const out: ScopeCandidates<BoardEntry<P, S, T, G>> = { game: new Map(), season: new Map() };
  const push = (scope: "game" | "season", stat: RawStatKey, entry: BoardEntry<P, S, T, G>) => {
    if (entry.value > 0) out[scope].set(stat, [...(out[scope].get(stat) ?? []), entry]);
  };
  for (const group of groups.values()) {
    const main = group.reduce((a, b) => (b.gamesPlayed > a.gamesPlayed ? b : a));
    const bests: Record<string, number> = {};
    const topGames: Record<string, GameEntry<G>[]> = {};
    for (const row of group) {
      for (const [k, v] of Object.entries(row.bests)) bests[k] = Math.max(bests[k] ?? v, v);
      for (const [k, v] of Object.entries(row.topGames ?? {})) topGames[k] = [...(topGames[k] ?? []), ...v];
    }
    const merged = { ...main, totals: aggregateLines(group.map((r) => r.totals)), bests, topGames };
    const base = { playerId: main.playerId, year: main.year, seasonId: main.seasonId, teamId: main.teamId };
    for (const stat of RECORD_STATS) {
      push("season", stat, { ...base, value: merged.totals[stat] ?? 0 });
      for (const game of gameEntries(merged, stat)) push("game", stat, { ...base, ...game });
    }
  }
  return out;
}

export type CareerRow<P extends string = string, T extends string = string> = {
  playerId: P;
  totals: StatLine;
  firstYear: number;
  lastYear: number;
  teamId?: T;
};

/** Career entries for every record stat from career totals. */
export function careerCandidates<P extends string, T extends string>(
  rows: readonly CareerRow<P, T>[],
): Map<RawStatKey, BoardEntry<P, string, T>[]> {
  const out = new Map<RawStatKey, BoardEntry<P, string, T>[]>();
  for (const row of rows) {
    for (const stat of RECORD_STATS) {
      const value = row.totals[stat] ?? 0;
      if (value <= 0) continue;
      const entry = {
        playerId: row.playerId,
        value,
        year: row.lastYear,
        firstYear: row.firstYear,
        ...(row.teamId ? { teamId: row.teamId } : {}),
      };
      out.set(stat, [...(out.get(stat) ?? []), entry]);
    }
  }
  return out;
}

export type TypedEntry<I extends string = string> = {
  _id: I;
  name: string;
  playerId?: string;
  teamId?: string;
  year?: number;
  value: number;
};

export type RankedEntry<I extends string = string> = {
  /** Shared by tied values. */
  rank: number;
  playerId?: string;
  /** Typed entries only: the name as typed. */
  name?: string;
  teamId?: string;
  value: number;
  year?: number;
  firstYear?: number;
  seasonId?: string;
  gameId?: string;
  weekKey?: WeekKey;
  typedId?: I;
};

/** Names compared for "the same holder": case, spaces and punctuation aside. */
export const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");

/**
 * A list as shown: computed entries with the typed ones merged in, best first, ties sharing a
 * rank. A typed entry replaces the computed entry for the same player (and, outside careers, the
 * same season when it names one): typed numbers fill in what the data cannot know.
 */
export function rankList<I extends string>(
  computed: readonly BoardEntry[],
  typed: readonly TypedEntry<I>[],
  scope: RecordScope,
  nameOf: (playerId: string) => string | undefined,
  limit: number = RECORD_TOP,
): RankedEntry<I>[] {
  const replaced = (e: BoardEntry) =>
    typed.some((t) => {
      const samePlayer = t.playerId
        ? t.playerId === e.playerId
        : normalizeName(t.name) === normalizeName(nameOf(e.playerId) ?? "");
      return samePlayer && (scope === "career" || t.year === undefined || t.year === e.year);
    });
  const merged: Omit<RankedEntry<I>, "rank">[] = [
    ...computed.filter((e) => !replaced(e)),
    ...typed.map((t) => ({
      playerId: t.playerId,
      name: t.name,
      teamId: t.teamId,
      value: t.value,
      year: t.year,
      typedId: t._id,
    })),
  ];
  return sharedRanks(merged.sort(byValue).slice(0, limit), (e) => e.value);
}

/** Ranks for a list already in order: an entry level with the one above it shares its rank. */
export function sharedRanks<E>(sorted: readonly E[], valueOf: (e: E) => number): (E & { rank: number })[] {
  const out: (E & { rank: number })[] = [];
  sorted.forEach((e, i) => {
    const above = out[i - 1];
    const level = above !== undefined && valueOf(above) === valueOf(e);
    out.push({ ...e, rank: level ? above.rank : i + 1 });
  });
  return out;
}
