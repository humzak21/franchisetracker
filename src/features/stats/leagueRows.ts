/** Rows of one position group's league stats table, mapped from the league query. */
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { positionGroupOf, type Position } from "@shared/domain";
import { isRawStatKey, statsInCategory, statValue, type StatGroup, type StatLine } from "@shared/stats";

type LeagueData = FunctionReturnType<typeof api.stats.league.bySeason>;
export type LeagueTeam = LeagueData["teams"][number];

/** Whose players the table lists. */
export type LeagueScope = "all" | "ours" | "others";

export type LeagueRow = {
  id: string;
  playerId: string;
  name: string;
  headshotUrl: string | null;
  position: Position;
  team: LeagueTeam | null;
  isUser: boolean;
  games: number;
  line: StatLine;
};

/** Players in the group (by position, or anyone with stats in the group's categories), within the scope. */
export function leagueRows(data: LeagueData, group: StatGroup, scope: LeagueScope): LeagueRow[] {
  const teams = new Map(data.teams.map((t) => [t._id, t]));
  // Raw stats only: everyone with a line scores fantasy points.
  const keys = group.categories.flatMap((c) => statsInCategory(c)).filter(isRawStatKey);
  return data.rows
    .filter((r) => (scope === "ours" ? r.isUser : scope === "others" ? !r.isUser : true))
    .filter((r) =>
      group.positions
        ? group.positions.includes(positionGroupOf(r.position))
        : keys.some((k) => (statValue(k, r.totals as StatLine) ?? 0) !== 0),
    )
    .map((r) => ({
      id: `${r.playerId}|${r.teamId}`,
      playerId: r.playerId,
      name: r.name,
      headshotUrl: r.headshotUrl,
      position: r.position,
      team: teams.get(r.teamId) ?? null,
      isUser: r.isUser,
      games: r.gamesPlayed,
      line: r.totals as StatLine,
    }));
}
