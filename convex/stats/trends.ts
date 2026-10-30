/**
 * Careers and seasons as curves (`docs/STATS-HUB.md` 6): a player's seasons and games, and the
 * team's seasons and scores, for the Trends view and the player page. Other teams' lines come
 * from box scores against us, so a player's games here are the ones with the user's team.
 */
import { v } from "convex/values";
import { weekPhase } from "../../shared/domain";
import { seasonSummary, sortByWeek, userScore } from "../../shared/games/summary";
import { ageInSeason } from "../../shared/players/format";
import { aggregateLines, type StatLine } from "../../shared/stats";
import { seasonInProgress } from "../../shared/stats/hub";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { vWlt } from "../games/validators";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { seasonYears } from "../lib/refs";
import { franchiseSeasonList, seasonGames } from "../lib/reports";
import { vStatMap, vWeekKey } from "../lib/validators";

/** Twenty seasons of a long career, as `players/gameLog:career` reads. */
const MAX_LINES = 600;
const MAX_SEASON_ROWS = 160;
/** One per record stat, regular season. */
const MAX_RECORDS = 200;

const gamesIn = ({ userRecord: r }: Doc<"seasons">) => (r?.w ?? 0) + (r?.l ?? 0) + (r?.t ?? 0);

/** A player's regular seasons, one per year: a mid-season trade adds up, and logs win over imports. */
function seasonFigures(rows: readonly Doc<"seasonPlayerStats">[], years: ReadonlyMap<Id<"seasons">, number>) {
  const bySeason = new Map<Id<"seasons">, Doc<"seasonPlayerStats">[]>();
  for (const row of rows) {
    if (row.split !== "regular") continue;
    bySeason.set(row.seasonId, [...(bySeason.get(row.seasonId) ?? []), row]);
  }
  return [...bySeason.entries()].flatMap(([seasonId, group]) => {
    const year = years.get(seasonId);
    if (year === undefined) return [];
    const logs = group.filter((r) => r.source === "logs");
    const counted = logs.length > 0 ? logs : group;
    return [
      {
        year,
        gamesPlayed: counted.reduce((n, r) => n + r.gamesPlayed, 0),
        totals: aggregateLines(counted.map((r) => r.totals as StatLine)) as Record<string, number>,
        imported: logs.length === 0,
      },
    ];
  });
}

export const player = query({
  args: { playerId: v.id("players") },
  returns: v.object({
    gamesPerSeason: v.number(),
    seasons: v.array(
      v.object({
        year: v.number(),
        age: v.union(v.number(), v.null()),
        gamesPlayed: v.number(),
        totals: vStatMap,
        imported: v.boolean(),
      }),
    ),
    games: v.array(
      v.object({
        gameId: v.id("games"),
        seasonId: v.id("seasons"),
        year: v.number(),
        weekKey: vWeekKey,
        stats: vStatMap,
      }),
    ),
    /** The franchise's single-season record per stat, the pace a season can be held against. */
    records: v.array(
      v.object({ statKey: v.string(), value: v.number(), year: v.union(v.number(), v.null()) }),
    ),
    /** The season being played: its year and the team's games so far. */
    live: v.union(v.object({ year: v.number(), teamGames: v.number() }), v.null()),
  }),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    const franchise = await activeFranchise(ctx);
    const { gamesPerSeason } = franchise.settings;
    const [rows, lines, records, seasons] = await Promise.all([
      ctx.db
        .query("seasonPlayerStats")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
        .take(MAX_SEASON_ROWS),
      ctx.db
        .query("gameStatLines")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
        .take(MAX_LINES),
      ctx.db
        .query("records")
        .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) =>
          q.eq("franchiseId", franchise._id).eq("split", "regular").eq("scope", "season"),
        )
        .take(MAX_RECORDS),
      franchiseSeasonList(ctx, franchise._id),
    ]);
    const years = await seasonYears(
      ctx,
      [...rows, ...lines].map((r) => r.seasonId),
    );
    const current = seasons.find((s) => {
      const record = s.userRecord;
      return seasonInProgress(
        s.status,
        (record?.w ?? 0) + (record?.l ?? 0) + (record?.t ?? 0),
        gamesPerSeason,
      );
    });
    return {
      gamesPerSeason,
      seasons: seasonFigures(rows, years)
        .sort((a, b) => a.year - b.year)
        .map((s) => ({ ...s, age: ageInSeason(player, s.year) })),
      games: lines.flatMap((line) => {
        const year = years.get(line.seasonId);
        return year !== undefined && line.teamId === franchise.userTeamId
          ? [
              {
                gameId: line.gameId,
                seasonId: line.seasonId,
                year,
                weekKey: line.weekKey,
                stats: line.stats,
              },
            ]
          : [];
      }),
      records: records.map((r) => ({ statKey: r.statKey, value: r.value, year: r.year ?? null })),
      live: current ? { year: current.year, teamGames: gamesIn(current) } : null,
    };
  },
});

/** The team's franchise seasons with every regular-season score, oldest first. */
export const team = query({
  args: {},
  returns: v.object({
    gamesPerSeason: v.number(),
    seasons: v.array(
      v.object({
        year: v.number(),
        record: vWlt,
        pointsFor: v.number(),
        pointsAgainst: v.number(),
        games: v.array(
          v.object({
            gameId: v.id("games"),
            weekKey: vWeekKey,
            pointsFor: v.number(),
            pointsAgainst: v.number(),
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const seasons = (await franchiseSeasonList(ctx, franchise._id)).filter(
      (s) => s.year >= franchise.startYear,
    );
    const rows = await Promise.all(
      seasons.map(async (season) => {
        const games = sortByWeek(await seasonGames(ctx, season._id));
        const scored = games.flatMap((game) => {
          const score = userScore(game);
          return score && weekPhase(game.weekKey) === "regular"
            ? [{ gameId: game._id, weekKey: game.weekKey, pointsFor: score.us, pointsAgainst: score.them }]
            : [];
        });
        return {
          year: season.year,
          record: seasonSummary(games).regular,
          pointsFor: scored.reduce((n, g) => n + g.pointsFor, 0),
          pointsAgainst: scored.reduce((n, g) => n + g.pointsAgainst, 0),
          games: scored,
        };
      }),
    );
    return {
      gamesPerSeason: franchise.settings.gamesPerSeason,
      seasons: rows.filter((s) => s.games.length > 0),
    };
  },
});
