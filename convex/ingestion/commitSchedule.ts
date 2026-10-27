/**
 * Commit for the league schedule screen: one week's games across the league, upserted per
 * matchup into `leagueGames`. The user team's game also goes through the game path, so its
 * schedule row, score and the season record agree with the league view; every other team's
 * standings record is worked out again from the scores.
 */
import { isWeekKey, weekLabel } from "../../shared/domain";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid } from "../lib/errors";
import { refreshLeagueRecords } from "../lib/leagueRecords";
import { findGame, refreshSeasonRecord, upsertGame } from "./commitGame";
import { numberOf, teamCache, textOf, type RowCommit, type RowCommitResult } from "./rowCommit";

/** Sixteen games a week, with room for a re-read that changed a matchup. */
const MAX_WEEK_GAMES = 40;

/** The week the games are filed under: the one the set was tagged with, checked against the header. */
function weekOf(commit: RowCommit) {
  const shown = commit.meta.week;
  const printed = typeof shown === "string" && isWeekKey(shown) ? shown : undefined;
  const weekKey = commit.weekKey ?? printed;
  if (!weekKey) throw invalid("Pick the week these games are from");
  if (printed && printed !== weekKey) {
    throw invalid(
      `The screen shows ${weekLabel(printed, "long")} but it is filed under ${weekLabel(weekKey, "long")}; fix one of them`,
    );
  }
  return weekKey;
}

export async function commitLeagueSchedule(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const weekKey = weekOf(commit);
  const seasonId = commit.season._id;
  const team = teamCache(ctx);
  let stored = await ctx.db
    .query("leagueGames")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
    .take(MAX_WEEK_GAMES);
  let userGame: { home: Doc<"teams">; away: Doc<"teams">; row: RowCommit["rows"][number] } | null = null;

  for (const row of commit.rows) {
    const away = await team(textOf(row, "awayTeam") ?? "");
    const home = await team(textOf(row, "homeTeam") ?? "");
    const awayScore = numberOf(row, "awayScore");
    const homeScore = numberOf(row, "homeScore");
    const timeLabel = textOf(row, "time");
    const fields = {
      awayTeamId: away._id,
      homeTeamId: home._id,
      // A screen read before kickoff leaves an earlier score alone rather than erasing it.
      ...(awayScore !== undefined && homeScore !== undefined ? { awayScore, homeScore } : {}),
      ...(timeLabel ? { timeLabel } : {}),
    };
    // A team plays once a week: a stored game with either team is this game, maybe misread before.
    const ids = new Set([away._id, home._id]);
    const same = stored.filter((g) => ids.has(g.awayTeamId) || ids.has(g.homeTeamId));
    const [kept, ...stale] = same;
    if (kept) await ctx.db.patch("leagueGames", kept._id, fields);
    else
      await ctx.db.insert("leagueGames", { franchiseId: commit.franchise._id, seasonId, weekKey, ...fields });
    for (const g of stale) await ctx.db.delete("leagueGames", g._id);
    stored = stored.filter((g) => !same.includes(g));
    if (ids.has(commit.franchise.userTeamId)) userGame = { home, away, row };
  }

  if (userGame) {
    const context = { seasonId, weekKey };
    // The schedule screen does not show overtime; keep what the box score said.
    const before = await findGame(ctx, context);
    const game = await upsertGame(ctx, commit.franchise, context, {
      homeAbbr: userGame.home.abbr,
      awayAbbr: userGame.away.abbr,
      homeScore: numberOf(userGame.row, "homeScore") ?? null,
      awayScore: numberOf(userGame.row, "awayScore") ?? null,
      overtime: before?.overtime ?? false,
      lineScore: null,
    });
    // Also brings every other team's record up to date.
    await refreshSeasonRecord(ctx, seasonId);
    await ctx.scheduler.runAfter(0, internal.stats.refresh.afterGame, { gameId: game._id, playerIds: [] });
  } else await refreshLeagueRecords(ctx, seasonId);
  return {};
}
