/**
 * The stat explorer (`shared/stats/explorer.ts`): one question, answered from wherever
 * `planQuestion` says. A board or the season rows when they hold it, game lines when the question
 * is narrow enough; a wider one comes back refused, with what to narrow.
 */
import { v } from "convex/values";
import { positionGroupOf } from "../../shared/domain";
import {
  answerFromLines,
  answerFromSeasons,
  bookSplit,
  EXPLORER_SCOPES,
  planQuestion,
  questionProblem,
  rankAnswer,
  streakPointLabel,
  streakSpanLabel,
  type ExplorerLine,
  type ExplorerRow,
  type Question,
  type SeasonFigure,
  type SplitGame,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { literals, vMarkHorizon, vPosition, vPositionGroup } from "../lib/validators";
import { readBoard } from "./boards";
import { countedGames, franchiseSeasons, playerLines } from "./load";
import { fastestList, seasonYears } from "./marks";
import { splitFacts, splitGamesOf } from "./splitGames";

/** A season's worth of one team's players, with room for trades and the practice squad. */
const MAX_ROWS_PER_SEASON_TEAM = 300;
/** One team's box score. */
const MAX_LINES_PER_GAME = 100;

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());

const vQuestion = v.object({
  scope: literals(EXPLORER_SCOPES),
  statKey: v.string(),
  split: v.string(),
  window: v.number(),
  mark: v.number(),
  horizon: vMarkHorizon,
  position: nullable(vPositionGroup),
  minGames: v.number(),
  fromYear: nullable(v.number()),
  toYear: nullable(v.number()),
  playerId: nullable(v.id("players")),
});

type Franchise = Doc<"franchises">;
type Seasons = readonly Doc<"seasons">[];

async function fromBoard(ctx: QueryCtx, franchise: Franchise, q: Question) {
  const split = bookSplit(q.split) ?? "regular";
  if (q.scope === "mark") {
    const years = await seasonYears(ctx, franchise._id);
    const list = await fastestList(ctx, franchise._id, years, q.statKey, q.mark, q.horizon);
    return rankAnswer(
      list.map((e) => ({
        key: `${e.playerId}-${e.gameId}`,
        playerId: e.playerId,
        value: e.gamesToReach,
        games: e.gamesToReach,
        when: streakPointLabel(e),
        gameId: e.gameId,
      })),
    );
  }
  if (q.scope === "span") {
    const board = await ctx.db
      .query("spanBoards")
      .withIndex("by_franchiseId_and_split_and_statKey_and_window", (i) =>
        i.eq("franchiseId", franchise._id).eq("split", split).eq("statKey", q.statKey).eq("window", q.window),
      )
      .unique();
    return rankAnswer(
      (board?.top ?? []).map((e) => ({
        key: `${e.playerId}-${e.startGameId}`,
        playerId: e.playerId,
        value: e.value,
        games: q.window,
        when: streakSpanLabel(
          { year: e.startYear, weekKey: e.startWeek },
          { year: e.endYear, weekKey: e.endWeek },
        ),
        gameId: e.startGameId,
      })),
    );
  }
  const board = await readBoard(ctx, franchise._id, "team", { split, scope: "game", statKey: q.statKey });
  return rankAnswer(
    (board?.top ?? []).map((e) => ({
      key: `${e.playerId}-${e.gameId ?? e.year}`,
      playerId: e.playerId,
      value: e.value,
      games: null,
      when: streakPointLabel(e),
      gameId: e.gameId ?? null,
    })),
  );
}

async function fromSeasons(ctx: QueryCtx, franchise: Franchise, q: Question, seasons: Seasons) {
  const split = bookSplit(q.split) ?? "regular";
  const figures: SeasonFigure[] = [];
  for (const season of seasons) {
    const rows = await ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_seasonId_and_teamId", (i) =>
        i.eq("seasonId", season._id).eq("teamId", franchise.userTeamId),
      )
      .take(MAX_ROWS_PER_SEASON_TEAM);
    for (const row of rows) {
      if (row.source !== "logs" || row.split !== split) continue;
      if (q.position !== null && row.positionGroup !== q.position) continue;
      figures.push({
        playerId: row.playerId,
        year: season.year,
        gamesPlayed: row.gamesPlayed,
        totals: row.totals,
      });
    }
  }
  return answerFromSeasons(q, figures);
}

/** One player's lines, or the team's game by game through the seasons asked about. */
async function linesFor(ctx: QueryCtx, franchise: Franchise, q: Question, seasons: Seasons) {
  const teams = await teamsById(ctx);
  const { userTeamId } = franchise;
  if (q.playerId !== null) {
    const asked = new Set(seasons.map((s) => s._id));
    const own = await playerLines(ctx, q.playerId as Id<"players">);
    const lines = own.filter((l) => l.teamId === userTeamId && asked.has(l.seasonId));
    return { lines, games: await splitGamesOf(ctx, lines, userTeamId, teams) };
  }
  const lines: (Doc<"gameStatLines"> & { year: number })[] = [];
  const games: SplitGame[] = [];
  for (const season of seasons) {
    for (const game of await countedGames(ctx, season)) {
      const facts = splitFacts(game, userTeamId, teams);
      if (!facts) continue;
      games.push(facts);
      const rows = await ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_teamId", (i) => i.eq("gameId", game._id).eq("teamId", userTeamId))
        .take(MAX_LINES_PER_GAME);
      lines.push(...rows.map((row) => ({ ...row, year: season.year })));
    }
  }
  return { lines, games };
}

async function fromLines(ctx: QueryCtx, franchise: Franchise, q: Question, seasons: Seasons) {
  const { lines, games } = await linesFor(ctx, franchise, q, seasons);
  const narrowed = await inPosition(ctx, q, lines);
  return answerFromLines(q, narrowed, new Map(games.map((g) => [g.gameId, g])));
}

/** A line says the position played; older lines fall back on the player's own. */
async function inPosition<L extends Doc<"gameStatLines"> & { year: number }>(
  ctx: QueryCtx,
  q: Question,
  lines: readonly L[],
): Promise<readonly ExplorerLine[]> {
  if (q.position === null) return lines;
  const players = await playersById(
    ctx,
    lines.filter((l) => !l.position).map((l) => l.playerId),
  );
  return lines.filter((l) => {
    const position = l.position ?? players.get(l.playerId)?.position;
    return position !== undefined && positionGroupOf(position) === q.position;
  });
}

/** The seasons a question covers, its plan, and the answer that plan reads. */
export async function answerQuestion(ctx: QueryCtx, franchise: Franchise, q: Question) {
  const seasons = (await franchiseSeasons(ctx, franchise._id)).filter(
    (s) =>
      s.year >= franchise.startYear && s.year >= (q.fromYear ?? s.year) && s.year <= (q.toYear ?? s.year),
  );
  const plan = planQuestion(q, seasons.length);
  if ("refused" in plan) return plan;
  const answer =
    plan.source === "board"
      ? await fromBoard(ctx, franchise, q)
      : plan.source === "seasons"
        ? await fromSeasons(ctx, franchise, q, seasons)
        : await fromLines(ctx, franchise, q, seasons);
  return { source: plan.source, answer };
}

export const run = query({
  args: { question: vQuestion },
  returns: v.union(
    v.object({ status: v.literal("refused"), message: v.string() }),
    v.object({
      status: v.literal("answered"),
      source: literals(["board", "seasons", "lines"] as const),
      total: v.number(),
      rows: v.array(
        v.object({
          key: v.string(),
          rank: v.number(),
          player: v.object({ playerId: v.id("players"), name: v.string(), position: vPosition }),
          value: v.number(),
          games: nullable(v.number()),
          when: nullable(v.string()),
          gameId: nullable(v.id("games")),
        }),
      ),
    }),
  ),
  handler: async (ctx, { question }) => {
    await requireOwner(ctx);
    const problem = questionProblem(question);
    if (problem) throw invalid(problem);
    // `questionProblem` has checked the stat and everything else the validator could not.
    const q = question as Question;
    const found = await answerQuestion(ctx, await activeFranchise(ctx), q);
    if ("refused" in found) return { status: "refused" as const, message: found.refused };
    const { source, answer } = found;
    const players = await playersById(
      ctx,
      answer.rows.map((r) => r.playerId as Id<"players">),
    );
    return {
      status: "answered" as const,
      source,
      total: answer.total,
      rows: answer.rows.flatMap((row: ExplorerRow & { rank: number }) => {
        const p = players.get(row.playerId as Id<"players">);
        if (!p) return [];
        return [
          {
            key: row.key,
            rank: row.rank,
            player: { playerId: p._id, name: p.displayName, position: p.position },
            value: row.value,
            games: row.games,
            when: row.when,
            gameId: row.gameId as Id<"games"> | null,
          },
        ];
      }),
    };
  },
});
