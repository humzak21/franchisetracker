/**
 * The league's regular-season stats: one line per player and team. The user team's players come
 * from its game logs (with games settled as missing on the reconcile screen), falling back to a
 * captured season stats screen; everyone else comes from captured season stats screens only,
 * because box scores hold just the games they played against the user team.
 */
import { withMissingGames } from "../../shared/ingestion/reconcile";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** 32 rosters of up to 75, with headroom for players traded mid-season. */
const MAX_LEAGUE_ROWS = 3000;
/** The user team's season rows, both splits and both sources. */
const MAX_TEAM_ROWS = 400;

export type LeagueStatLine = {
  playerId: Id<"players">;
  teamId: Id<"teams">;
  isUser: boolean;
  /** `logs`: the user team's box scores; `reported`: a captured season stats screen. */
  source: "logs" | "reported";
  gamesPlayed: number;
  totals: Record<string, number>;
};

export async function leagueSeasonLines(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
  seasonId: Id<"seasons">,
): Promise<LeagueStatLine[]> {
  const userTeamId = franchise.userTeamId;
  const [reported, logged] = await Promise.all([
    ctx.db
      .query("reportedSeasonStats")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId))
      .take(MAX_LEAGUE_ROWS),
    ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", userTeamId))
      .take(MAX_TEAM_ROWS),
  ]);
  const userReported = new Map(
    reported.filter((r) => r.teamId === userTeamId).map((r) => [r.playerId, r] as const),
  );
  const fromLogs = logged.filter((r) => r.split === "regular" && r.source === "logs");
  const logPlayers = new Set(fromLogs.map((r) => r.playerId));
  return [
    ...fromLogs.map((row) => {
      const shown = withMissingGames(row, userReported.get(row.playerId));
      return {
        playerId: row.playerId,
        teamId: userTeamId,
        isUser: true,
        source: "logs" as const,
        gamesPlayed: shown.gamesPlayed,
        totals: shown.totals,
      };
    }),
    ...reported
      .filter((r) => r.teamId !== userTeamId || !logPlayers.has(r.playerId))
      .map((r) => ({
        playerId: r.playerId,
        teamId: r.teamId,
        isUser: r.teamId === userTeamId,
        source: "reported" as const,
        gamesPlayed: r.gamesPlayed ?? 0,
        totals: r.stats,
      })),
  ];
}
