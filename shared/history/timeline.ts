/**
 * Narrative timeline (FEATURES.md 5.7): notes from games, seasons, transactions, awards and the
 * Hall of Fame as one story. Seasons read newest first; inside a season, in the order it happened.
 */
import { weekIndex, type WeekKey } from "../domain/calendar";

export const TIMELINE_KINDS = ["game", "season", "transaction", "award", "hof"] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  game: "Games",
  season: "Seasons",
  transaction: "Transactions",
  award: "Awards",
  hof: "Hall of Fame",
};

/**
 * When in the season an entry sits: before kickoff (pre-season report, season notes, offseason
 * moves), a week, or after the last game (yearly awards, the post-season report, inductions).
 */
export type TimelineAt = "start" | WeekKey | "end";

export type TimelineEntry = { id: string; kind: TimelineKind; year: number; at: TimelineAt; order?: number };

const END = 10_000;

/** Position inside the season; `order` breaks ties between entries at the same point. */
function position(entry: TimelineEntry): number {
  const base = entry.at === "start" ? -END : entry.at === "end" ? END : weekIndex(entry.at) * 100;
  return base + (entry.order ?? 0);
}

/** Newest season first, then in season order. */
export function sortTimeline<T extends TimelineEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) => b.year - a.year || position(a) - position(b) || a.id.localeCompare(b.id),
  );
}

/** Consecutive runs of one season, for year headers. Expects sorted input. */
export function groupByYear<T extends TimelineEntry>(
  entries: readonly T[],
): { year: number; entries: T[] }[] {
  const groups: { year: number; entries: T[] }[] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last?.year === entry.year) last.entries.push(entry);
    else groups.push({ year: entry.year, entries: [entry] });
  }
  return groups;
}

/** Entry counts per kind, for the filter chips. */
export function countByKind(entries: readonly { kind: TimelineKind }[]): Record<TimelineKind, number> {
  const counts = Object.fromEntries(TIMELINE_KINDS.map((k) => [k, 0])) as Record<TimelineKind, number>;
  for (const entry of entries) counts[entry.kind]++;
  return counts;
}
