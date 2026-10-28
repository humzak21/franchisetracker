/**
 * Loads a franchise season's whole league schedule from nflverse before kickoff (Madden's first
 * season plays the real NFL schedule): every regular-season matchup and kickoff time into
 * `leagueGames`, and the user team's games onto its schedule. Scores are never imported; they
 * come from the games played in Madden. Weeks that already have games are left as they are, so a
 * schedule Madden has changed (or a week already captured) is never overwritten.
 */
import { v } from "convex/values";
import { NFLVERSE_URLS } from "../../shared/history/nflverse";
import { parseSchedule } from "../../shared/history/nflverseSchedule";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { fetchText } from "../history/importStep";
import { findGame, refreshSeasonRecord, teamByAbbr } from "../ingestion/commitGame";
import { upsertUserGame, upsertWeekGames, type WeekGame } from "../ingestion/commitSchedule";
import { requireOwnerAction } from "../lib/auth";
import { invalid, notFound } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vWeekKey } from "../lib/validators";

const vResult = v.object({ weeks: v.number(), skipped: v.number() });

const vScheduled = v.object({
  weekKey: vWeekKey,
  away: v.string(),
  home: v.string(),
  timeLabel: v.optional(v.string()),
});

/** The season's year, if it is one the franchise plays (real seasons before it are imported whole). */
export const seasonYear = internalQuery({
  args: { seasonId: v.id("seasons") },
  returns: v.number(),
  handler: async (ctx, { seasonId }) => {
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) throw notFound("Season");
    if (season.year < franchise.startYear) throw invalid("Real NFL seasons already come with their games");
    return season.year;
  },
});

export const write = internalMutation({
  args: { seasonId: v.id("seasons"), games: v.array(vScheduled) },
  returns: vResult,
  handler: async (ctx, { seasonId, games }) => {
    const franchise = await activeFranchise(ctx);
    const teams = new Map<string, Doc<"teams">>();
    const team = async (abbr: string) => {
      const found = teams.get(abbr) ?? (await teamByAbbr(ctx, abbr));
      teams.set(abbr, found);
      return found;
    };
    const weeks = [...new Set(games.map((g) => g.weekKey))];
    let skipped = 0;
    for (const weekKey of weeks) {
      const [leagueGame, ownGame] = await Promise.all([
        ctx.db
          .query("leagueGames")
          .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
          .first(),
        findGame(ctx, { seasonId, weekKey }),
      ]);
      if (leagueGame) {
        skipped++;
        continue;
      }
      const week: WeekGame[] = [];
      for (const g of games.filter((g) => g.weekKey === weekKey)) {
        week.push({ away: await team(g.away), home: await team(g.home), timeLabel: g.timeLabel });
      }
      const userGame = await upsertWeekGames(ctx, franchise, seasonId, weekKey, week);
      if (userGame && !ownGame) await upsertUserGame(ctx, franchise, { seasonId, weekKey }, userGame);
    }
    await refreshSeasonRecord(ctx, seasonId);
    return { weeks: weeks.length - skipped, skipped };
  },
});

export const fromNflverse = action({
  args: { seasonId: v.id("seasons") },
  returns: vResult,
  handler: async (ctx, { seasonId }): Promise<typeof vResult.type> => {
    await requireOwnerAction(ctx);
    const year: number = await ctx.runQuery(internal.leagueGames.importSchedule.seasonYear, { seasonId });
    const games = parseSchedule(await fetchText(NFLVERSE_URLS.games), year);
    if (games.length === 0) throw invalid(`nflverse has no ${year} schedule yet`);
    return await ctx.runMutation(internal.leagueGames.importSchedule.write, { seasonId, games });
  },
});
