/**
 * The dashboard's season (FEATURES.md 5.1): the header line, the last result and the next
 * opponent with the head-to-head so far, and the week-by-week pulse.
 */
import { v } from "convex/values";
import { rivalries } from "../../shared/games/insights";
import { seasonSummary, sortByWeek, userScore } from "../../shared/games/summary";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { vGameRow, vSeasonSummary, vWeekPoint, vWlt } from "../games/validators";
import { gameRow, starPlayerIds, weekPointRows } from "../games/views";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { franchiseSeasonList, seasonGames } from "../lib/reports";
import { vGameResult, vWeekKey } from "../lib/validators";

/** Every meeting with one opponent across the franchise. */
const MAX_MEETINGS = 100;

const vMeeting = v.object({
  year: v.number(),
  weekKey: vWeekKey,
  us: v.number(),
  them: v.number(),
  result: vGameResult,
});

/** All-time record against an opponent and the latest meeting, from every franchise season. */
async function headToHead(ctx: QueryCtx, franchise: Doc<"franchises">, opponentTeamId: Id<"teams">) {
  const [meetings, seasons] = await Promise.all([
    ctx.db
      .query("games")
      .withIndex("by_franchiseId_and_opponentTeamId", (q) =>
        q.eq("franchiseId", franchise._id).eq("opponentTeamId", opponentTeamId),
      )
      .take(MAX_MEETINGS),
    franchiseSeasonList(ctx, franchise._id),
  ]);
  const yearOf = new Map(seasons.map((s) => [s._id, s.year]));
  const [line] = rivalries(meetings.map((m) => ({ ...m, year: yearOf.get(m.seasonId) ?? 0 })));
  return { record: line?.record ?? { w: 0, l: 0, t: 0 }, last: line?.last ?? null };
}

export const season = query({
  args: { seasonId: v.id("seasons") },
  returns: v.union(
    v.null(),
    v.object({
      summary: vSeasonSummary,
      pulse: v.array(vWeekPoint),
      divisionRank: v.union(v.number(), v.null()),
      seed: v.union(v.number(), v.null()),
      lastGame: v.union(vGameRow, v.null()),
      nextGame: v.union(
        v.null(),
        v.object({
          game: vGameRow,
          opponentRecord: v.union(vWlt, v.null()),
          headToHead: v.object({ record: vWlt, last: v.union(vMeeting, v.null()) }),
        }),
      ),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) return null;

    const games = sortByWeek(await seasonGames(ctx, seasonId));
    const lastIndex = games.findLastIndex((g) => userScore(g) !== null);
    const last = games[lastIndex];
    const next = games.slice(lastIndex + 1).find((g) => g.status === "scheduled" && g.opponentTeamId);
    const [teams, players, standing] = await Promise.all([
      teamsById(ctx),
      playersById(ctx, starPlayerIds(last ? [last] : [])),
      ctx.db
        .query("standings")
        .withIndex("by_seasonId_and_teamId", (q) =>
          q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
        )
        .unique(),
    ]);

    let nextGame = null;
    if (next?.opponentTeamId) {
      const opponentId = next.opponentTeamId;
      const [opponentStanding, h2h] = await Promise.all([
        ctx.db
          .query("standings")
          .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", opponentId))
          .unique(),
        headToHead(ctx, franchise, opponentId),
      ]);
      const recordAtKickoff = next.opponentRecord ?? opponentStanding;
      nextGame = {
        game: gameRow(next, teams, players),
        opponentRecord: recordAtKickoff
          ? { w: recordAtKickoff.w, l: recordAtKickoff.l, t: recordAtKickoff.t ?? 0 }
          : null,
        headToHead: h2h,
      };
    }

    return {
      summary: seasonSummary(games),
      pulse: weekPointRows(games, teams),
      divisionRank: standing?.divisionRank ?? season.userRecord?.divisionRank ?? null,
      seed: standing?.seed ?? season.userRecord?.seed ?? null,
      lastGame: last ? gameRow(last, teams, players) : null,
      nextGame,
    };
  },
});
