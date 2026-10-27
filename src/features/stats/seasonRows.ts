/** Rows of one position group's season stats table, mapped from the season query. */
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { positionGroupOf } from "@shared/domain";
import {
  aggregateLines,
  statsInCategory,
  statValue,
  type SeasonHigh,
  type StatGroup,
  type StatLine,
} from "@shared/stats";

export type SeasonStatRow = FunctionReturnType<typeof api.stats.season.bySplit>[number];

export type Row = {
  id: string;
  playerId: string | null;
  name: string;
  position: string;
  jersey: number | null;
  games: number | null;
  line: StatLine;
  counts: Record<string, number>;
  highs: Record<string, SeasonHigh<Id<"games">>>;
};

/** Players in the group: by season position, or anyone with stats in the group's categories. */
export function groupRows(rows: readonly SeasonStatRow[], group: StatGroup): Row[] {
  const keys = group.categories.flatMap((c) => statsInCategory(c));
  return rows
    .filter((r) => {
      if (group.positions) return group.positions.includes(r.positionGroup ?? positionGroupOf(r.position));
      return keys.some((k) => (statValue(k, r.totals as StatLine) ?? 0) !== 0);
    })
    .map((r) => ({
      id: r.playerId,
      playerId: r.playerId,
      name: r.name,
      position: r.position,
      jersey: r.jersey,
      games: r.gamesPlayed,
      line: r.totals as StatLine,
      counts: r.thresholdCounts,
      highs: r.bestGames,
    }));
}

export function totalsRow(rows: readonly Row[]): Row {
  return {
    id: "totals",
    playerId: null,
    name: "Team",
    position: "",
    jersey: null,
    // The team played as many games as its busiest player, so per-game rates stay meaningful.
    games: Math.max(0, ...rows.map((r) => r.games ?? 0)),
    line: aggregateLines(rows.map((r) => r.line)),
    counts: {},
    highs: {},
  };
}
