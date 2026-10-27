/**
 * Other teams' records from the scores the franchise knows: every league game from the schedule
 * screen plus the user team's own games. Run after anything that changes a score, so a team's
 * standings row keeps up with its games (`shared/league/records.ts`).
 */
import { recordsFromGames, shouldReplaceRecord, type ScoredGame } from "../../shared/league/records";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { must } from "./errors";
import { seasonGames } from "./reports";

/** A full season of league games with the playoffs, with headroom. */
const MAX_LEAGUE_GAMES = 400;
const MAX_TEAMS = 64;

export async function refreshLeagueRecords(ctx: MutationCtx, seasonId: Id<"seasons">): Promise<void> {
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  const franchise = must(await ctx.db.get("franchises", season.franchiseId), "Franchise");
  // Real NFL seasons before the franchise keep their imported standings untouched.
  if (season.year < franchise.startYear) return;

  const [league, own, rows] = await Promise.all([
    ctx.db
      .query("leagueGames")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_LEAGUE_GAMES),
    seasonGames(ctx, seasonId),
    ctx.db
      .query("standings")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId))
      .take(MAX_TEAMS),
  ]);
  const games: ScoredGame[] = [
    ...league,
    // The user team's games come last: their box score is the more trusted score of the two.
    ...own.flatMap((g) =>
      g.homeTeamId && g.awayTeamId ? [{ ...g, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId }] : [],
    ),
  ];
  const records = recordsFromGames(games);

  const stored = new Map(rows.map((r) => [r.teamId as string, r]));
  for (const [teamId, record] of records) {
    // The user team's record is its season's, kept by `refreshSeasonRecord`.
    if (teamId === franchise.userTeamId) continue;
    const row = stored.get(teamId);
    if (!shouldReplaceRecord(row ? { ...row, derived: row.source === "derived" } : null, record)) continue;
    const fields = { ...record, source: row && row.source !== "derived" ? row.source : ("derived" as const) };
    if (row) await ctx.db.patch("standings", row._id, fields);
    else {
      await ctx.db.insert("standings", {
        franchiseId: franchise._id,
        seasonId,
        teamId: teamId as Id<"teams">,
        ...fields,
      });
    }
  }
  // A worked-out row whose games are all gone (a game deleted or re-read as another matchup) goes too.
  for (const row of rows) {
    if (row.source === "derived" && !records.has(row.teamId)) await ctx.db.delete("standings", row._id);
  }
}
