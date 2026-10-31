/** A player's game-by-game lines for one season, each with its game's opponent and score. */
import { v } from "convex/values";
import { isTouchdown } from "../../shared/domain";
import { sortByWeek, userScore } from "../../shared/games/summary";
import {
  distinctMarks,
  inCareerOrder,
  isStatKey,
  markLabel,
  statValue,
  type MarkStat,
  type StatLine,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { activeFranchise, teamsById } from "../lib/franchise";
import { seasonYears, toTeamRef, vTeamRef } from "../lib/refs";
import { vGameResult, vScoringKind, vStatMap, vWeekKey } from "../lib/validators";

/** A season plus playoffs, with room for a preseason. */
const MAX_LINES = 40;
/** Touchdowns in a season: a monster year stays well under this. */
const MAX_PLAYS = 100;
/** Twenty seasons of a long career, playoffs included. */
const MAX_CAREER_LINES = 600;
const MAX_CAREER_PLAYS = 600;
/** Every mark a player can hold, every horizon. */
const MAX_MARKS = 600;

const vLogRow = v.object({
  gameId: v.id("games"),
  seasonId: v.id("seasons"),
  year: v.number(),
  weekKey: vWeekKey,
  opponent: v.union(vTeamRef, v.null()),
  home: v.boolean(),
  result: v.union(vGameResult, v.null()),
  score: v.union(v.object({ us: v.number(), them: v.number() }), v.null()),
  stats: vStatMap,
  /** Touchdowns in the game, where its scoring summary was captured. */
  touchdowns: v.array(v.object({ period: v.number(), clock: v.number(), kind: vScoringKind })),
  /** The marks he reached in the game: "1,000 rushing yards". */
  marks: v.array(v.string()),
});

/** Each game's marks for a player, one line per mark, career first. */
async function marksByGame(ctx: QueryCtx, playerId: Id<"players">) {
  const rows = await ctx.db
    .query("playerMarks")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .take(MAX_MARKS);
  const out = new Map<string, string[]>();
  for (const m of distinctMarks(rows.map((r) => ({ ...r, statKey: r.statKey as MarkStat })))) {
    out.set(m.gameId, [...(out.get(m.gameId) ?? []), markLabel(m)]);
  }
  return out;
}

/** Lines as a game log shows them, each with its game's opponent, score and touchdowns. */
async function logRows(
  ctx: QueryCtx,
  lines: readonly Doc<"gameStatLines">[],
  plays: readonly Doc<"scoringPlays">[],
  playerId: Id<"players">,
) {
  const [franchise, teams, marks] = await Promise.all([
    activeFranchise(ctx),
    teamsById(ctx),
    marksByGame(ctx, playerId),
  ]);
  const years = await seasonYears(
    ctx,
    lines.map((l) => l.seasonId),
  );
  const rows = await Promise.all(
    lines.map(async (line) => {
      const game = await ctx.db.get("games", line.gameId);
      if (!game) return null;
      // Box scores hold both teams; flip the user's point of view for an opponent's player.
      const mine = line.teamId === franchise.userTeamId;
      const forUser = userScore(game);
      const score = forUser && (mine ? forUser : { us: forUser.them, them: forUser.us });
      const opponentId = game.homeTeamId === line.teamId ? game.awayTeamId : game.homeTeamId;
      const opponent = opponentId ? teams.get(opponentId) : undefined;
      return {
        gameId: game._id,
        seasonId: line.seasonId,
        year: years.get(line.seasonId) ?? 0,
        weekKey: line.weekKey,
        opponent: opponent ? toTeamRef(opponent) : null,
        home: game.homeTeamId === line.teamId,
        result: score ? (score.us > score.them ? "W" : score.us < score.them ? "L" : "T") : null,
        score,
        stats: line.stats,
        touchdowns: plays
          .filter((p) => p.gameId === game._id && isTouchdown(p.kind))
          .map(({ period, clock, kind }) => ({ period, clock, kind })),
        marks: marks.get(game._id) ?? [],
      } as const;
    }),
  );
  return rows.filter((r) => r !== null);
}

export const bySeason = query({
  args: { playerId: v.id("players"), seasonId: v.id("seasons") },
  returns: v.array(vLogRow),
  handler: async (ctx, { playerId, seasonId }) => {
    await requireOwner(ctx);
    const lines = await ctx.db
      .query("gameStatLines")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
      .take(MAX_LINES);
    const plays = await ctx.db
      .query("scoringPlays")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
      .take(MAX_PLAYS);
    return await logRows(ctx, sortByWeek(lines), plays, playerId);
  },
});

/** Every game of a career, oldest first; `filter` keeps the games with at least `min` of a stat. */
export const career = query({
  args: {
    playerId: v.id("players"),
    filter: v.optional(v.object({ statKey: v.string(), min: v.number() })),
  },
  returns: v.array(vLogRow),
  handler: async (ctx, { playerId, filter }) => {
    await requireOwner(ctx);
    const { statKey } = filter ?? {};
    if (statKey !== undefined && !isStatKey(statKey)) throw invalid(`Unknown stat ${statKey}`);
    const lines = await ctx.db
      .query("gameStatLines")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_CAREER_LINES);
    const plays = await ctx.db
      .query("scoringPlays")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_CAREER_PLAYS);
    const kept =
      filter && statKey !== undefined && isStatKey(statKey)
        ? lines.filter((l) => (statValue(statKey, l.stats as StatLine) ?? 0) >= filter.min)
        : lines;
    const rows = await logRows(ctx, kept, plays, playerId);
    return inCareerOrder(rows);
  },
});
