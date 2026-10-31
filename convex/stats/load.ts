/**
 * Reads the stats engines need, all scoped to the franchise and bounded. Franchise records,
 * leaders and streaks count what happened with the user's team, from game logs only.
 */
import { weekIndex, weekPhase } from "../../shared/domain";
import type { SeasonRow, StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MAX_SEASONS } from "../lib/franchise";

const MAX_GAMES_PER_SEASON = 40;
/** A season's worth of one team's players, with room for trades and the practice squad. */
const MAX_ROWS_PER_SEASON_TEAM = 300;
/** Twenty seasons of a long career, playoffs included. */
const MAX_PLAYER_LINES = 600;

export type Split = "regular" | "postseason";

export async function franchiseSeasons(ctx: QueryCtx, franchiseId: Id<"franchises">) {
  return await ctx.db
    .query("seasons")
    .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchiseId))
    .take(MAX_SEASONS);
}

/** The user team's log-derived season rows per split, each with its year. */
export async function userSeasonRows(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
): Promise<Record<Split, SeasonRow<Id<"players">, Id<"seasons">, Id<"games">>[]>> {
  const out: Record<Split, SeasonRow<Id<"players">, Id<"seasons">, Id<"games">>[]> = {
    regular: [],
    postseason: [],
  };
  for (const season of await franchiseSeasons(ctx, franchise._id)) {
    // Imported seasons before the franchise hold no log-derived rows.
    if (season.year < franchise.startYear) continue;
    const rows = await ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_seasonId_and_teamId", (q) =>
        q.eq("seasonId", season._id).eq("teamId", franchise.userTeamId),
      )
      .take(MAX_ROWS_PER_SEASON_TEAM);
    for (const row of rows) {
      if (row.source !== "logs") continue;
      out[row.split].push({
        playerId: row.playerId,
        seasonId: season._id,
        year: season.year,
        totals: row.totals as StatLine,
        bests: row.bests ?? {},
        topGames: row.topGames,
      });
    }
  }
  return out;
}

const counts = (weekKey: Doc<"games">["weekKey"]) => ["regular", "postseason"].includes(weekPhase(weekKey));

/** A season's regular-season and playoff games, each with its year. */
export async function countedGames(ctx: QueryCtx, season: Doc<"seasons">) {
  const rows = await ctx.db
    .query("games")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", season._id))
    .take(MAX_GAMES_PER_SEASON);
  return rows.filter((g) => counts(g.weekKey)).map((g) => ({ ...g, year: season.year }));
}

const inGameOrder = (a: Doc<"games"> & { year: number }, b: Doc<"games"> & { year: number }) =>
  a.year - b.year || weekIndex(a.weekKey) - weekIndex(b.weekKey);

/** Every regular-season and playoff game of the franchise, oldest first, with its season's year. */
export async function franchiseGames(ctx: QueryCtx, franchiseId: Id<"franchises">) {
  const games: Awaited<ReturnType<typeof countedGames>> = [];
  for (const season of await franchiseSeasons(ctx, franchiseId)) {
    games.push(...(await countedGames(ctx, season)));
  }
  return games.sort(inGameOrder);
}

/** One season's games, oldest first. */
export async function orderedSeasonGames(ctx: QueryCtx, season: Doc<"seasons">) {
  return (await countedGames(ctx, season)).sort(inGameOrder);
}

/** A player's regular-season and playoff lines across every season, oldest first. */
export async function playerLines(ctx: QueryCtx, playerId: Id<"players">) {
  const lines = await ctx.db
    .query("gameStatLines")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
    .take(MAX_PLAYER_LINES);
  const years = new Map<Id<"seasons">, number>();
  for (const id of new Set(lines.map((l) => l.seasonId))) {
    const season = await ctx.db.get("seasons", id);
    if (season) years.set(id, season.year);
  }
  return lines
    .filter((l) => counts(l.weekKey) && years.has(l.seasonId))
    .map((l) => ({ ...l, year: years.get(l.seasonId) ?? 0 }))
    .sort((a, b) => a.year - b.year || weekIndex(a.weekKey) - weekIndex(b.weekKey));
}
