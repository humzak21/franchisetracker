/** A player's career with one team, as a Hall of Fame plaque summarizes it. */
import { preferLogs, summarizeSeasons, type StatLine } from "../../shared/stats";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { seasonYears } from "./refs";

/** Twenty-plus real seasons before the franchise, two splits each, then the franchise run. */
const MAX_ROWS = 160;

export type TeamCareer = {
  /** Seasons with the team, oldest first: roster seasons and seasons with stats for it. */
  years: number[];
  totals: StatLine;
  games: number;
  /** The number worn in the latest roster season with the team. */
  jersey: number | undefined;
};

export async function careerWithTeam(
  ctx: QueryCtx,
  playerId: Id<"players">,
  teamId: Id<"teams">,
): Promise<TeamCareer> {
  const [entries, stats] = await Promise.all([
    ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_ROWS),
    ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_ROWS),
  ]);
  const ours = entries.filter((e) => e.teamId === teamId);
  const rows = stats.filter((r) => r.teamId === teamId && r.split === "regular");
  const years = await seasonYears(
    ctx,
    [...ours, ...rows].map((r) => r.seasonId),
  );
  const seasons = preferLogs(
    rows.flatMap((r) => {
      const year = years.get(r.seasonId);
      return year === undefined ? [] : [{ ...r, year, teamKey: r.teamId as string }];
    }),
  );
  const summary = summarizeSeasons(
    seasons.map((r) => ({
      gamesPlayed: r.gamesPlayed,
      totals: r.totals as StatLine,
      thresholdCounts: r.thresholdCounts ?? {},
      bests: r.bests ?? {},
    })),
  );
  const latest = ours
    .map((e) => ({ year: years.get(e.seasonId), jersey: e.jersey }))
    .filter((e): e is { year: number; jersey: number | undefined } => e.year !== undefined)
    .sort((a, b) => b.year - a.year)[0];
  return {
    years: [...new Set(years.values())].sort((a, b) => a - b),
    totals: summary.totals,
    games: summary.gamesPlayed,
    jersey: latest?.jersey,
  };
}
