/**
 * Commit for the league schedule screen: one week's games across the league, upserted per
 * matchup into `leagueGames`. The user team's game also goes through the game path, so its
 * schedule row, score and the season record agree with the league view; every other team's
 * standings record is worked out again from the scores.
 */
import { isWeekKey, weekLabel, type WeekKey } from "../../shared/domain";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid } from "../lib/errors";
import { refreshLeagueRecords } from "../lib/leagueRecords";
import { findGame, refreshSeasonRecord, upsertGame } from "./commitGame";
import { numberOf, teamCache, textOf, type RowCommit, type RowCommitResult } from "./rowCommit";

/** Sixteen games a week, with room for a re-read that changed a matchup. */
const MAX_WEEK_GAMES = 40;

/**
 * The week each row is filed under. A row's own week (read from its screen's header, for sets
 * that cover several weeks) wins; otherwise the week the set was tagged with, checked against
 * the header. A tagged week the rows contradict is an error to fix, not something to guess at.
 */
function weeksOf(commit: RowCommit): WeekKey[] {
  const shown = commit.meta.week;
  const printed = typeof shown === "string" && isWeekKey(shown) ? shown : undefined;
  const weeks = commit.rows.map((row) => {
    const own = textOf(row, "week");
    return own && isWeekKey(own) ? own : undefined;
  });
  const several = new Set(weeks.filter(Boolean)).size > 1;
  return weeks.map((own) => {
    const weekKey = own ?? commit.weekKey ?? printed;
    if (!weekKey) throw invalid("Pick the week these games are from");
    const header = own ?? printed;
    if (!several && header && commit.weekKey && header !== commit.weekKey) {
      throw invalid(
        `The screen shows ${weekLabel(header, "long")} but it is filed under ${weekLabel(commit.weekKey, "long")}; fix one of them`,
      );
    }
    return weekKey;
  });
}

export type WeekGame = {
  away: Doc<"teams">;
  home: Doc<"teams">;
  awayScore?: number;
  homeScore?: number;
  timeLabel?: string;
};

/**
 * Upserts one week's games into `leagueGames`, one row per matchup, and returns the user team's
 * game if it plays. A game read before kickoff leaves an earlier score alone rather than erasing it.
 */
export async function upsertWeekGames(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  seasonId: Id<"seasons">,
  weekKey: WeekKey,
  games: readonly WeekGame[],
): Promise<WeekGame | null> {
  let stored = await ctx.db
    .query("leagueGames")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
    .take(MAX_WEEK_GAMES);
  let userGame: WeekGame | null = null;
  for (const game of games) {
    const { away, home, awayScore, homeScore, timeLabel } = game;
    const fields = {
      awayTeamId: away._id,
      homeTeamId: home._id,
      ...(awayScore !== undefined && homeScore !== undefined ? { awayScore, homeScore } : {}),
      ...(timeLabel ? { timeLabel } : {}),
    };
    // A team plays once a week: a stored game with either team is this game, maybe misread before.
    const ids = new Set([away._id, home._id]);
    const same = stored.filter((g) => ids.has(g.awayTeamId) || ids.has(g.homeTeamId));
    const [kept, ...stale] = same;
    if (kept) await ctx.db.patch("leagueGames", kept._id, fields);
    else await ctx.db.insert("leagueGames", { franchiseId: franchise._id, seasonId, weekKey, ...fields });
    for (const g of stale) await ctx.db.delete("leagueGames", g._id);
    stored = stored.filter((g) => !same.includes(g));
    if (ids.has(franchise.userTeamId)) userGame = game;
  }
  return userGame;
}

/** The user team's game on its schedule, scored if the screen had the score. */
export async function upsertUserGame(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  context: { seasonId: Id<"seasons">; weekKey: WeekKey },
  game: WeekGame,
) {
  // The schedule screen does not show overtime; keep what the box score said.
  const before = await findGame(ctx, context);
  return await upsertGame(ctx, franchise, context, {
    homeAbbr: game.home.abbr,
    awayAbbr: game.away.abbr,
    homeScore: game.homeScore ?? null,
    awayScore: game.awayScore ?? null,
    overtime: before?.overtime ?? false,
    lineScore: null,
  });
}

export async function commitLeagueSchedule(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const seasonId = commit.season._id;
  const team = teamCache(ctx);
  const weeks = weeksOf(commit);
  const byWeek = new Map<WeekKey, WeekGame[]>();
  for (const [i, row] of commit.rows.entries()) {
    const weekKey = weeks[i]!;
    byWeek.set(weekKey, [
      ...(byWeek.get(weekKey) ?? []),
      {
        away: await team(textOf(row, "awayTeam") ?? ""),
        home: await team(textOf(row, "homeTeam") ?? ""),
        awayScore: numberOf(row, "awayScore"),
        homeScore: numberOf(row, "homeScore"),
        timeLabel: textOf(row, "time"),
      },
    ]);
  }
  let userPlayed = false;
  for (const [weekKey, games] of byWeek) {
    const userGame = await upsertWeekGames(ctx, commit.franchise, seasonId, weekKey, games);
    if (!userGame) continue;
    userPlayed = true;
    const game = await upsertUserGame(ctx, commit.franchise, { seasonId, weekKey }, userGame);
    await ctx.scheduler.runAfter(0, internal.stats.refresh.afterGame, { gameId: game._id, playerIds: [] });
  }
  // The season record refresh also brings every other team's record up to date.
  if (userPlayed) await refreshSeasonRecord(ctx, seasonId);
  else await refreshLeagueRecords(ctx, seasonId);
  return {};
}
