/** Rewrites team and player streak rows from the franchise's games and the players' game logs. */
import { resultOf } from "../../shared/games/summary";
import {
  PLAYER_STREAK_MARKS,
  playerStreaks,
  seasonStreaks,
  STREAK_LABELS,
  teamStreaks,
  type Run,
  type StatLine,
  type StreakKey,
  type TeamStatLine,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { teamsById } from "../lib/franchise";
import { franchiseGames, franchiseSeasons, playerLines } from "./load";

type Measured = Run<Id<"seasons">> & { key: string };

/** Team streaks and a player's fit under this; a row's dates change with its numbers. */
const MAX_STREAK_ROWS = 40;

const sameRun = (row: Doc<"streaks">, m: Measured) =>
  JSON.stringify([row.current, row.longest, row.currentFrom, row.longestFrom, row.longestTo]) ===
  JSON.stringify([m.current, m.longest, m.currentFrom, m.longestFrom, m.longestTo]);

async function writeStreaks(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  playerId: Id<"players"> | undefined,
  measured: readonly Measured[],
): Promise<Map<string, Doc<"streaks">>> {
  const existing = await ctx.db
    .query("streaks")
    .withIndex("by_franchiseId_and_playerId", (q) =>
      q.eq("franchiseId", franchiseId).eq("playerId", playerId),
    )
    .take(MAX_STREAK_ROWS);
  const before = new Map(existing.map((s) => [s.key, s]));
  for (const row of existing)
    if (!measured.some((m) => m.key === row.key)) await ctx.db.delete("streaks", row._id);
  for (const m of measured) {
    const row = before.get(m.key);
    if (!row) await ctx.db.insert("streaks", { franchiseId, playerId, ...m });
    else if (!sameRun(row, m)) {
      const { currentFrom, longestFrom, longestTo } = m;
      await ctx.db.patch("streaks", row._id, {
        current: m.current,
        longest: m.longest,
        currentFrom,
        longestFrom,
        longestTo,
      });
    }
  }
  return before;
}

/** The games a team streak measures, with what each season's run needs. */
async function teamGames(ctx: QueryCtx, franchise: Doc<"franchises">) {
  const teams = await teamsById(ctx);
  const user = teams.get(franchise.userTeamId);
  const games = await franchiseGames(ctx, franchise._id);
  return await Promise.all(
    games.map(async (g) => {
      const opponent = g.opponentTeamId ? teams.get(g.opponentTeamId) : undefined;
      const sides = await ctx.db
        .query("gameTeamStats")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", g._id))
        .take(2);
      const theirs = sides.find((s) => s.teamId !== franchise.userTeamId)?.stats as TeamStatLine | undefined;
      const home = g.homeScore ?? 0;
      const away = g.awayScore ?? 0;
      return {
        at: { seasonId: g.seasonId, year: g.year, weekKey: g.weekKey },
        result: resultOf(g),
        home: g.userIsHome ?? false,
        division:
          !!opponent &&
          !!user &&
          opponent.conference === user.conference &&
          opponent.division === user.division,
        us: g.userIsHome ? home : away,
        them: g.userIsHome ? away : home,
        takeaways: theirs?.turnovers ?? null,
      };
    }),
  );
}

/** Finished seasons, from their games, for the season-long runs. */
async function teamSeasons(ctx: QueryCtx, franchise: Doc<"franchises">) {
  const seasons = await franchiseSeasons(ctx, franchise._id);
  const finished = seasons.filter((s) => s.status === "complete").sort((a, b) => a.year - b.year);
  return await Promise.all(
    finished.map(async (season) => {
      const standing = await ctx.db
        .query("standings")
        .withIndex("by_seasonId_and_teamId", (q) =>
          q.eq("seasonId", season._id).eq("teamId", franchise.userTeamId),
        )
        .first();
      const { w = 0, l = 0, playoffResult } = season.userRecord ?? {};
      return {
        at: { seasonId: season._id, year: season.year },
        wins: w,
        losses: l,
        playoffs: playoffResult !== undefined && playoffResult !== "missed",
        divisionTitle: standing?.divisionRank === 1,
      };
    }),
  );
}

/** Team streaks; returns the win streak before and after so a new length can be celebrated. */
export async function refreshTeamStreaks(ctx: MutationCtx, franchise: Doc<"franchises">) {
  const measured = [
    ...teamStreaks(await teamGames(ctx, franchise)),
    ...seasonStreaks(await teamSeasons(ctx, franchise)),
  ];
  const before = await writeStreaks(ctx, franchise._id, undefined, measured);
  return {
    winsBefore: before.get("wins")?.current ?? 0,
    winsAfter: measured.find((m) => m.key === "wins")?.current ?? 0,
  };
}

/** A player's streaks over their games with the user team; also returns those lines for milestone detection. */
export async function refreshPlayerStreaks(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  player: Doc<"players">,
) {
  const lines = await playerLines(ctx, player._id);
  const withTeam = lines.filter((l) => l.teamId === franchise.userTeamId);
  const measured = playerStreaks(
    withTeam.map((l) => ({
      at: { seasonId: l.seasonId, year: l.year, weekKey: l.weekKey },
      line: l.stats as StatLine,
    })),
  );
  const before = await writeStreaks(ctx, franchise._id, player._id, measured);
  const reached = measured.flatMap((m) =>
    m.current > (before.get(m.key)?.current ?? 0) && PLAYER_STREAK_MARKS.has(m.current)
      ? [{ key: m.key as StreakKey, length: m.current, label: STREAK_LABELS[m.key as StreakKey] }]
      : [],
  );
  return { lines, reached };
}
