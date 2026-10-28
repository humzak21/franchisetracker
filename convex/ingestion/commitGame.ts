/** Finds or creates the game a committed screenshot belongs to, and keeps the season record cache current. */
import { isPlayoffRound, type WeekKey } from "../../shared/domain";
import { resultOf, seasonSummary } from "../../shared/games/summary";
import { laterStatus, playoffResultFromGames, statusFromGames } from "../../shared/seasons/lifecycle";
import type { GameHeader } from "../../shared/ingestion/types";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";
import { refreshLeagueRecords } from "../lib/leagueRecords";
import { seasonGames } from "../lib/reports";
import { teamSeasonTotals } from "../stats/teamTotals";

export async function teamByAbbr(ctx: MutationCtx, abbr: string | null): Promise<Doc<"teams">> {
  const team = abbr
    ? await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
        .unique()
    : null;
  return must(team, `Team ${abbr ?? "(missing)"}`);
}

/**
 * Where a draft is filed: an upload set's tags or a manual entry's context. A game, or a season
 * and week (game and weekly screens), or a season alone (season screens).
 */
export type DraftContext = { gameId?: Id<"games">; seasonId?: Id<"seasons">; weekKey?: WeekKey };

/** The draft's game: the pre-tagged one, else the season's game that week, else a new one. */
export async function findGame(ctx: MutationCtx, context: DraftContext): Promise<Doc<"games"> | null> {
  if (context.gameId) return await ctx.db.get("games", context.gameId);
  const { seasonId, weekKey } = context;
  if (!seasonId || !weekKey) throw invalid("Tag the screenshots with a season and week first");
  return await ctx.db
    .query("games")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
    .first();
}

/**
 * Writes the score header onto the game. One side must be the user's team; an existing game
 * against a different opponent is a conflict, not something to overwrite silently.
 */
export async function upsertGame(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  context: DraftContext,
  header: GameHeader,
): Promise<Doc<"games">> {
  const home = await teamByAbbr(ctx, header.homeAbbr);
  const away = await teamByAbbr(ctx, header.awayAbbr);
  const userIsHome = home._id === franchise.userTeamId;
  if (!userIsHome && away._id !== franchise.userTeamId) {
    throw invalid("Neither team in the screenshot is yours; check the home and away teams");
  }
  const opponent = userIsHome ? away : home;
  const existing = await findGame(ctx, context);
  if (existing?.opponentTeamId && existing.opponentTeamId !== opponent._id) {
    throw invalid(`That week already has a game against another team; check the week or the teams`);
  }
  const seasonId = existing?.seasonId ?? must(context.seasonId, "Season");
  const weekKey = existing?.weekKey ?? must(context.weekKey, "Week");
  const scored = header.homeScore !== null && header.awayScore !== null;
  const fields = {
    homeTeamId: home._id,
    awayTeamId: away._id,
    opponentTeamId: opponent._id,
    userIsHome,
    ...(scored
      ? {
          homeScore: header.homeScore ?? undefined,
          awayScore: header.awayScore ?? undefined,
          overtime: header.overtime,
          status: "played" as const,
        }
      : {}),
    ...(header.lineScore ? { lineScore: header.lineScore } : {}),
    ...(isPlayoffRound(weekKey) ? { playoffRound: weekKey } : {}),
  };
  let gameId: Id<"games">;
  if (existing) {
    gameId = existing._id;
    await ctx.db.patch("games", gameId, fields);
  } else {
    gameId = await ctx.db.insert("games", {
      franchiseId: franchise._id,
      seasonId,
      weekKey,
      status: "scheduled",
      ...fields,
    });
  }
  const game = must(await ctx.db.get("games", gameId), "Game");
  const result = resultOf(game);
  if (!result) return game;
  await ctx.db.patch("games", gameId, { result });
  return { ...game, result };
}

/**
 * Refreshes `seasons.userRecord` (regular season W-L-T and where the playoff run ended) and the
 * team stats derived from the games (`seasons.teamTotals`), and moves the season along its
 * lifecycle: the first regular-season result starts it, a playoff game makes it the postseason,
 * and a played Super Bowl completes it, which makes the post-season report due. Status only
 * moves forward.
 */
export async function refreshSeasonRecord(ctx: MutationCtx, seasonId: Id<"seasons">): Promise<void> {
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  const games = await seasonGames(ctx, seasonId);
  const { regular } = seasonSummary(games);
  const playoffResult = playoffResultFromGames(games) ?? season.userRecord?.playoffResult;
  await ctx.db.patch("seasons", seasonId, {
    userRecord: { ...season.userRecord, ...regular, ...(playoffResult ? { playoffResult } : {}) },
    status: laterStatus(season.status, statusFromGames(games)),
    teamTotals: await teamSeasonTotals(ctx, season, games),
  });
  // The opponent's record moves with the score too.
  await refreshLeagueRecords(ctx, seasonId);
}
