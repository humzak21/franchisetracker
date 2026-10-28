/**
 * Turns stored rows into records-board updates (`shared/stats/recordBoards.ts`): the team book
 * counts the user team's rows of every season, real seasons before the franchise included; the
 * all-time book counts every team's rows, Madden's league leaders screens and career totals.
 */
import {
  aggregateLines,
  careerCandidates,
  isStatKey,
  preferLogs,
  RECORD_STATS,
  seasonCandidates,
  type BoardBook,
  type RawStatKey,
  type StatLine,
  type StatRow,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { BoardEntry, BoardUpdate } from "./boards";
import type { Split } from "./load";

type Row = StatRow<Id<"players">, Id<"seasons">, Id<"teams">>;

export const toStatRow = (row: Doc<"seasonPlayerStats">, year: number): Row => ({
  playerId: row.playerId,
  seasonId: row.seasonId,
  year,
  teamId: row.teamId,
  gamesPlayed: row.gamesPlayed,
  totals: row.totals as StatLine,
  bests: row.bests ?? {},
});

/**
 * Season and single-game updates for one book and split from season rows. Within one season a
 * captured season (logs) replaces the imported one for the same team, as careers do.
 */
export function seasonUpdates(
  book: BoardBook,
  split: Split,
  rows: readonly (Doc<"seasonPlayerStats"> & { year: number })[],
): BoardUpdate[] {
  const kept = preferLogs(
    rows.filter((r) => r.split === split).map((r) => ({ ...r, teamKey: `${r.playerId}|${r.teamId}` })),
  );
  const candidates = seasonCandidates(kept.map((r) => toStatRow(r, r.year)));
  return (["season", "game"] as const).flatMap((scope) =>
    [...candidates[scope]].map(([statKey, entries]) => ({ book, split, scope, statKey, entries })),
  );
}

/** Career updates from per-player totals. */
export function careerUpdates(
  book: BoardBook,
  split: Split,
  rows: readonly {
    playerId: Id<"players">;
    totals: StatLine;
    firstYear: number;
    lastYear: number;
    teamId?: Id<"teams">;
  }[],
): BoardUpdate[] {
  return [...careerCandidates(rows)].map(([statKey, entries]) => ({
    book,
    split,
    scope: "career" as const,
    statKey,
    entries: entries as BoardEntry[],
  }));
}

/** A player's career with the user team: every season with it, imported or captured. */
export function teamCareer(
  rows: readonly (Doc<"seasonPlayerStats"> & { year: number })[],
  split: Split,
  userTeamId: Id<"teams">,
) {
  const kept = preferLogs(
    rows
      .filter((r) => r.split === split && r.teamId === userTeamId)
      .map((r) => ({ ...r, teamKey: r.teamId })),
  );
  if (kept.length === 0) return null;
  const years = kept.map((r) => r.year);
  return {
    playerId: kept[0]!.playerId,
    totals: aggregateLines(kept.map((r) => r.totals as StatLine)),
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
    teamId: userTeamId,
  };
}

/** Season entries from Madden's league leaders screens: the players nobody captured a box score for. */
export function leaderUpdates(
  leaders: readonly Doc<"leagueLeaders">[],
  season: { _id: Id<"seasons">; year: number },
): BoardUpdate[] {
  const byStat = new Map<RawStatKey, BoardEntry[]>();
  for (const l of leaders) {
    if (!l.playerId || !isStatKey(l.statKey) || !(RECORD_STATS as readonly string[]).includes(l.statKey))
      continue;
    const stat = l.statKey as RawStatKey;
    const entry = {
      playerId: l.playerId,
      value: l.value,
      year: season.year,
      seasonId: season._id,
      teamId: l.teamId,
    };
    byStat.set(stat, [...(byStat.get(stat) ?? []), entry]);
  }
  return [...byStat].map(([statKey, entries]) => ({
    book: "league" as const,
    split: "regular" as const,
    scope: "season" as const,
    statKey,
    entries,
  }));
}
