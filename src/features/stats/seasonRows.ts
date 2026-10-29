/** Rows of one position group's season stats table, mapped from the season query. */
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { positionGroupOf } from "@shared/domain";
import {
  aggregateLines,
  isRawStatKey,
  statsInCategory,
  statValue,
  type SeasonHigh,
  type StatGroup,
  type StatLine,
} from "@shared/stats";

export type SeasonStatRow = FunctionReturnType<typeof api.stats.season.bySplit>[number];

export type Row = {
  id: string;
  playerId: Id<"players"> | null;
  /** Logs or imported real-NFL totals; null on the team totals row. */
  source: SeasonStatRow["source"] | null;
  name: string;
  headshotUrl: string | null;
  position: string;
  jersey: number | null;
  games: number | null;
  line: StatLine;
  counts: Record<string, number>;
  highs: Record<string, SeasonHigh<Id<"games">>>;
  /** Stats showing the season screen's number (see `withMissingGames`). */
  overridden: readonly string[];
};

/** Players in the group: by season position, or anyone with stats in the group's categories. */
export function groupRows(rows: readonly SeasonStatRow[], group: StatGroup): Row[] {
  // Raw stats only: everyone with a line scores fantasy points.
  const keys = group.categories.flatMap((c) => statsInCategory(c)).filter(isRawStatKey);
  return rows
    .filter((r) => {
      if (group.positions) return group.positions.includes(r.positionGroup ?? positionGroupOf(r.position));
      return keys.some((k) => (statValue(k, r.totals as StatLine) ?? 0) !== 0);
    })
    .map((r) => ({
      id: r.playerId,
      playerId: r.playerId,
      source: r.source,
      name: r.name,
      headshotUrl: r.headshotUrl,
      position: r.position,
      jersey: r.jersey,
      games: r.gamesPlayed,
      line: r.totals as StatLine,
      counts: r.thresholdCounts,
      highs: r.bestGames,
      overridden: r.overridden,
    }));
}

export function totalsRow(rows: readonly Row[]): Row {
  return {
    id: "totals",
    playerId: null,
    source: null,
    name: "Team",
    headshotUrl: null,
    position: "",
    jersey: null,
    // The team played as many games as its busiest player, so per-game rates stay meaningful.
    games: Math.max(0, ...rows.map((r) => r.games ?? 0)),
    line: aggregateLines(rows.map((r) => r.line)),
    counts: {},
    highs: {},
    overridden: [],
  };
}
