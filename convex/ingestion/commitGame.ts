/** Finds or creates the game a committed screenshot belongs to, and keeps the season record cache current. */
import { isPlayoffRound } from "../../shared/domain";
import { resultOf, seasonSummary } from "../../shared/games/summary";
import type { GameHeader } from "../../shared/ingestion/types";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";

const MAX_GAMES_PER_SEASON = 40;

export async function teamByAbbr(ctx: MutationCtx, abbr: string | null): Promise<Doc<"teams">> {
  const team = abbr
    ? await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
        .unique()
    : null;
  return must(team, `Team ${abbr ?? "(missing)"}`);
}

/** The game for this upload set: the pre-tagged one, else the season's game that week, else a new one. */
export async function findGame(ctx: MutationCtx, lead: Doc<"uploads">): Promise<Doc<"games"> | null> {
  if (lead.gameId) return await ctx.db.get("games", lead.gameId);
  const { seasonId, weekKey } = lead;
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
  lead: Doc<"uploads">,
  header: GameHeader,
): Promise<Doc<"games">> {
  const home = await teamByAbbr(ctx, header.homeAbbr);
  const away = await teamByAbbr(ctx, header.awayAbbr);
  const userIsHome = home._id === franchise.userTeamId;
  if (!userIsHome && away._id !== franchise.userTeamId) {
    throw invalid("Neither team in the screenshot is yours; check the home and away teams");
  }
  const opponent = userIsHome ? away : home;
  const existing = await findGame(ctx, lead);
  if (existing?.opponentTeamId && existing.opponentTeamId !== opponent._id) {
    throw invalid(`That week already has a game against another team; check the week or the teams`);
  }
  const seasonId = existing?.seasonId ?? must(lead.seasonId, "Season");
  const weekKey = existing?.weekKey ?? must(lead.weekKey, "Week");
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

/** Refreshes `seasons.userRecord` (regular season W-L-T) from the season's games. */
export async function refreshSeasonRecord(ctx: MutationCtx, seasonId: Id<"seasons">): Promise<void> {
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  const games = await ctx.db
    .query("games")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
    .take(MAX_GAMES_PER_SEASON);
  const { regular } = seasonSummary(games);
  await ctx.db.patch("seasons", seasonId, { userRecord: { ...season.userRecord, ...regular } });
}
