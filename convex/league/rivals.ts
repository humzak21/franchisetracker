/**
 * Rivalries (FEATURES.md 5.2 head-to-head, 5.6): the user team's line against every opponent it
 * has met inside the franchise, from the captured games, and one rivalry in full.
 */
import { v } from "convex/values";
import { weekIndex, weekPhase } from "../../shared/domain";
import { rivalries } from "../../shared/games/insights";
import { meetingHighs, performersAgainst } from "../../shared/games/rivalry";
import { resultOf, userScore } from "../../shared/games/summary";
import { LEADER_STATS } from "../../shared/seasons/summary";
import type { StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { vWlt } from "../games/validators";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { headshotUrls, toTeamRef, vTeamRef } from "../lib/refs";
import { franchiseSeasonList } from "../lib/reports";
import { literals, vGameResult, vPosition, vWeekKey } from "../lib/validators";

/** Twenty seasons of full schedules, with playoffs. */
const MAX_GAMES = 600;
/** Every meeting with one opponent: a division rival plays twice a year, for decades. */
const MAX_MEETINGS = 100;
/** The user team's lines in one game. */
const MAX_GAME_LINES = 80;
const COUNTED_PHASES = new Set(["regular", "postseason"]);

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      opponent: vTeamRef,
      record: vWlt,
      playoff: vWlt,
      pointsFor: v.number(),
      pointsAgainst: v.number(),
      streak: v.string(),
      last: v.object({
        year: v.number(),
        weekKey: vWeekKey,
        us: v.number(),
        them: v.number(),
        result: vGameResult,
      }),
      margins: v.array(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [games, seasons, teams] = await Promise.all([
      // Byes carry no opponent; the index's franchise prefix still reads every game.
      ctx.db
        .query("games")
        .withIndex("by_franchiseId_and_opponentTeamId", (q) => q.eq("franchiseId", franchise._id))
        .take(MAX_GAMES),
      franchiseSeasonList(ctx, franchise._id),
      teamsById(ctx),
    ]);
    const yearOf = new Map(seasons.map((s) => [s._id, s.year]));
    return rivalries(games.map((g) => ({ ...g, year: yearOf.get(g.seasonId) ?? 0 }))).flatMap(
      ({ opponentTeamId, ...line }) => {
        const team = teams.get(opponentTeamId);
        return team ? [{ opponent: toTeamRef(team), ...line }] : [];
      },
    );
  },
});

const vMeeting = v.object({
  gameId: v.id("games"),
  year: v.number(),
  weekKey: vWeekKey,
  us: v.number(),
  them: v.number(),
  result: vGameResult,
});
const vHighGame = v.union(vMeeting, v.null());
const vPlayer = v.object({
  _id: v.id("players"),
  displayName: v.string(),
  position: vPosition,
  headshotUrl: v.union(v.string(), v.null()),
});

export async function rivalryPage(ctx: QueryCtx, franchise: Doc<"franchises">, opponent: Doc<"teams">) {
  const [games, seasons] = await Promise.all([
    ctx.db
      .query("games")
      .withIndex("by_franchiseId_and_opponentTeamId", (q) =>
        q.eq("franchiseId", franchise._id).eq("opponentTeamId", opponent._id),
      )
      .take(MAX_MEETINGS),
    franchiseSeasonList(ctx, franchise._id),
  ]);
  const yearOf = new Map(seasons.map((s) => [s._id, s.year]));
  const dated = games.map((g) => ({ ...g, year: yearOf.get(g.seasonId) ?? 0 }));
  const line = rivalries(dated)[0];
  const played = dated
    .flatMap((g) => {
      const score = userScore(g);
      const result = resultOf(g);
      if (!score || !result || !COUNTED_PHASES.has(weekPhase(g.weekKey))) return [];
      return [{ gameId: g._id, year: g.year, weekKey: g.weekKey, ...score, result }];
    })
    .sort((a, b) => b.year - a.year || weekIndex(b.weekKey) - weekIndex(a.weekKey));
  const lines = (
    await Promise.all(
      played.map((g) =>
        ctx.db
          .query("gameStatLines")
          .withIndex("by_gameId_and_teamId", (q) =>
            q.eq("gameId", g.gameId).eq("teamId", franchise.userTeamId),
          )
          .take(MAX_GAME_LINES),
      ),
    )
  ).flat();
  const performers = performersAgainst(
    lines.map((l) => ({ playerId: l.playerId, gameId: l.gameId, stats: l.stats as StatLine })),
  );
  const players = await playersById(
    ctx,
    performers.flatMap((p) => [...p.rows.map((r) => r.playerId), p.best.playerId]),
  );
  const photos = await headshotUrls(ctx, players.values());
  const chip = (id: Id<"players">) => {
    const p = players.get(id);
    return p
      ? {
          _id: p._id,
          displayName: p.displayName,
          position: p.position,
          headshotUrl: photos.get(id) ?? null,
        }
      : null;
  };
  return {
    opponent: toTeamRef(opponent),
    record: line?.record ?? { w: 0, l: 0, t: 0 },
    playoff: line?.playoff ?? { w: 0, l: 0, t: 0 },
    pointsFor: line?.pointsFor ?? 0,
    pointsAgainst: line?.pointsAgainst ?? 0,
    streak: line?.streak ?? null,
    games: played,
    highs: meetingHighs(played),
    performers: performers.flatMap(({ stat, rows, best }) => {
      const top = chip(best.playerId);
      if (!top) return [];
      return [
        {
          stat,
          rows: rows.flatMap(({ playerId, ...row }) => {
            const player = chip(playerId);
            return player ? [{ player, ...row }] : [];
          }),
          best: { player: top, value: best.value, gameId: best.gameId as Id<"games"> },
        },
      ];
    }),
  };
}

/** One rivalry in full: every meeting, the games and runs that stand out, and our best against them. */
export const get = query({
  args: { teamAbbr: v.string() },
  returns: v.object({
    opponent: vTeamRef,
    record: vWlt,
    playoff: vWlt,
    pointsFor: v.number(),
    pointsAgainst: v.number(),
    streak: v.union(v.string(), v.null()),
    games: v.array(vMeeting),
    highs: v.object({
      bestWin: vHighGame,
      worstLoss: vHighGame,
      mostScored: vHighGame,
      mostAllowed: vHighGame,
      longestWin: v.number(),
      longestLoss: v.number(),
    }),
    performers: v.array(
      v.object({
        stat: literals(LEADER_STATS),
        rows: v.array(v.object({ player: vPlayer, value: v.number(), games: v.number() })),
        best: v.object({ player: vPlayer, value: v.number(), gameId: v.id("games") }),
      }),
    ),
  }),
  handler: async (ctx, { teamAbbr }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const opponent = must(
      await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", teamAbbr.toUpperCase()))
        .unique(),
      `Team ${teamAbbr}`,
    );
    return rivalryPage(ctx, franchise, opponent);
  },
});
