/** Season and report lookups shared by the lifecycle, report and timeline functions. */
import { NEW_PROMPTS } from "../../shared/seasons/reports";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { invalid, must } from "./errors";
import { activeFranchise } from "./franchise";

/** A season's games: the schedule, byes and playoffs fit well under this. */
const MAX_GAMES_PER_SEASON = 40;
const MAX_SEASONS = 100;

export async function seasonGames(ctx: QueryCtx, seasonId: Id<"seasons">): Promise<Doc<"games">[]> {
  return await ctx.db
    .query("games")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
    .take(MAX_GAMES_PER_SEASON);
}

export async function franchiseSeasonList(ctx: QueryCtx, franchiseId: Id<"franchises">) {
  return await ctx.db
    .query("seasons")
    .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchiseId))
    .take(MAX_SEASONS);
}

export async function seasonByYear(ctx: QueryCtx, franchiseId: Id<"franchises">, year: number) {
  return await ctx.db
    .query("seasons")
    .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchiseId).eq("year", year))
    .unique();
}

/**
 * The active franchise and one of its own seasons. Real NFL seasons before the franchise are
 * imported history: nobody wrote reports or set a staff for them here, so they are refused.
 */
export async function ownSeason(
  ctx: QueryCtx,
  seasonId: Id<"seasons">,
): Promise<{ franchise: Doc<"franchises">; season: Doc<"seasons"> }> {
  const franchise = await activeFranchise(ctx);
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  if (season.franchiseId !== franchise._id) throw invalid("That season belongs to another franchise");
  if (season.year < franchise.startYear) {
    throw invalid(`${season.year} is real NFL history from before the franchise`);
  }
  return { franchise, season };
}

export async function reportFor(ctx: QueryCtx, seasonId: Id<"seasons">) {
  return await ctx.db
    .query("seasonReports")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
    .unique();
}

/** Reports are created on first write, so seasons from before Sprint 5 need no backfill. */
export async function ensureReport(ctx: MutationCtx, season: Doc<"seasons">): Promise<Doc<"seasonReports">> {
  const existing = await reportFor(ctx, season._id);
  if (existing) return existing;
  const id = await ctx.db.insert("seasonReports", {
    franchiseId: season.franchiseId,
    seasonId: season._id,
    prompts: NEW_PROMPTS,
    needs: [],
  });
  return must(await ctx.db.get("seasonReports", id), "Season report");
}
