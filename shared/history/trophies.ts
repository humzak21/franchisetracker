/**
 * Trophy room and decade grids, generated from season records plus any real-history entries
 * the owner adds (titles from before the franchise began). Pure.
 */
import type { PlayoffResult } from "../domain/calendar";

export const TROPHY_KINDS = ["superBowl", "conference", "division", "playoffs"] as const;
export type TrophyKind = (typeof TROPHY_KINDS)[number];

export const TROPHY_LABELS: Record<TrophyKind, { title: string; one: string }> = {
  superBowl: { title: "Super Bowls", one: "Super Bowl champion" },
  conference: { title: "Conference titles", one: "Conference champion" },
  division: { title: "Division titles", one: "Division champion" },
  playoffs: { title: "Playoff appearances", one: "Made the playoffs" },
};

export type SeasonRecordLike = {
  year: number;
  userRecord?: { w: number; l: number; t: number; divisionRank?: number; playoffResult?: PlayoffResult };
};

export type TrophyEntryLike = { year: number; kind: TrophyKind };

export type TrophyYear = { year: number; source: "franchise" | "history" };

/** Which trophies a season's result earns. A Super Bowl win implies the conference title and a playoff trip. */
export function trophiesFor(season: SeasonRecordLike): TrophyKind[] {
  const record = season.userRecord;
  if (!record) return [];
  const kinds: TrophyKind[] = [];
  const result = record.playoffResult;
  if (result === "champion") kinds.push("superBowl");
  if (result === "champion" || result === "sb_loss") kinds.push("conference");
  if (record.divisionRank === 1) kinds.push("division");
  if (result && result !== "missed") kinds.push("playoffs");
  return kinds;
}

/**
 * Years per trophy kind, newest first, merging season results and hand-added entries. Seasons
 * before `startYear` are imported real history, so their trophies count as history too.
 */
export function trophyRoom(
  seasons: readonly SeasonRecordLike[],
  entries: readonly TrophyEntryLike[],
  startYear: number,
): Record<TrophyKind, TrophyYear[]> {
  const room = Object.fromEntries(TROPHY_KINDS.map((kind) => [kind, [] as TrophyYear[]])) as Record<
    TrophyKind,
    TrophyYear[]
  >;
  for (const season of seasons) {
    const source = season.year < startYear ? "history" : "franchise";
    for (const kind of trophiesFor(season)) room[kind].push({ year: season.year, source });
  }
  for (const entry of entries) {
    if (!room[entry.kind].some((t) => t.year === entry.year))
      room[entry.kind].push({ year: entry.year, source: "history" });
  }
  for (const kind of TROPHY_KINDS) room[kind].sort((a, b) => b.year - a.year);
  return room;
}

export type DecadeTotals = { w: number; l: number; t: number; playoffs: number; titles: number };

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** Seasons grouped by decade (oldest first) with totals per decade. */
export function byDecade<T extends SeasonRecordLike>(
  seasons: readonly T[],
): { decade: number; seasons: T[]; totals: DecadeTotals }[] {
  const groups = new Map<number, T[]>();
  for (const season of [...seasons].sort((a, b) => a.year - b.year)) {
    const decade = decadeOf(season.year);
    groups.set(decade, [...(groups.get(decade) ?? []), season]);
  }
  return [...groups.entries()].map(([decade, list]) => ({ decade, seasons: list, totals: totalsOf(list) }));
}

export function totalsOf(seasons: readonly SeasonRecordLike[]): DecadeTotals {
  const totals: DecadeTotals = { w: 0, l: 0, t: 0, playoffs: 0, titles: 0 };
  for (const season of seasons) {
    const record = season.userRecord;
    if (!record) continue;
    totals.w += record.w;
    totals.l += record.l;
    totals.t += record.t;
    const kinds = trophiesFor(season);
    if (kinds.includes("playoffs")) totals.playoffs++;
    if (kinds.includes("superBowl")) totals.titles++;
  }
  return totals;
}
