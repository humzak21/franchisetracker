/**
 * What scoring plays feed once they change: the scoring records and the game's milestones
 * (first career touchdown, the game-winner, a connection's mark). Runs as its own scheduled
 * mutation, like `stats/refresh`, and rebuilds from the plays, so running it twice changes nothing.
 */
import { v } from "convex/values";
import { isTouchdown } from "../../shared/domain";
import { sortByWeek } from "../../shared/games/summary";
import {
  buildScoringBoards,
  connectionMarksCrossed,
  connections,
  gameFlow,
  SCORED_TD_STATS,
  SCORING_LIST_KEYS,
  type ScoredGame,
  type ScoringEntry,
  type StatLine,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, MAX_SEASONS, playersById, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { vPosition, vStatSplit, vWeekKey } from "../lib/validators";

/** A season of scores for both teams, playoffs included: 40 games at 40 plays at the very most. */
const MAX_PLAYS_PER_SEASON = 1600;
/** Two splits of every list, with room for lists that have since moved. */
const MAX_BOARDS = 2 * SCORING_LIST_KEYS.length + 10;
/** Rows a player can have: regular season and playoffs. */
const MAX_CAREER_ROWS = 2;

const known = new Set<string>(SCORING_LIST_KEYS);

const SCORING_MILESTONES = new Set<Doc<"milestones">["kind"]>(["first_td", "game_winner", "connection"]);

type Scored = ScoredGame<Id<"teams">, Id<"players">, Id<"seasons">, Id<"games">>;
type Entry = ScoringEntry<Id<"teams">, Id<"players">, Id<"seasons">, Id<"games">>;

/** Every game with plays, in the order they were played. */
async function scoredGames(ctx: QueryCtx, franchiseId: Id<"franchises">): Promise<Scored[]> {
  const seasons = await ctx.db
    .query("seasons")
    .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchiseId))
    .take(MAX_SEASONS);
  const out: Scored[] = [];
  for (const season of seasons) {
    const plays = await ctx.db
      .query("scoringPlays")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id))
      .take(MAX_PLAYS_PER_SEASON);
    const byGame = new Map<Id<"games">, Doc<"scoringPlays">[]>();
    for (const play of plays) byGame.set(play.gameId, [...(byGame.get(play.gameId) ?? []), play]);
    const games = await Promise.all([...byGame.keys()].map((id) => ctx.db.get("games", id)));
    for (const game of sortByWeek(games.filter((g): g is Doc<"games"> => g !== null))) {
      if (!game.homeTeamId || !game.awayTeamId) continue;
      out.push({
        gameId: game._id,
        seasonId: season._id,
        year: season.year,
        weekKey: game.weekKey,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        plays: byGame.get(game._id) ?? [],
      });
    }
  }
  return out;
}

/** Writes each list only when it changed; a list that emptied goes. */
async function writeBoards(ctx: MutationCtx, franchise: Doc<"franchises">, games: readonly Scored[]) {
  const boards = buildScoringBoards(games, franchise.userTeamId);
  const existing = await ctx.db
    .query("scoringBoards")
    .withIndex("by_franchiseId_and_split_and_list", (q) => q.eq("franchiseId", franchise._id))
    .take(MAX_BOARDS);
  const stored = new Map(existing.map((b) => [`${b.split}|${b.list}`, b]));
  // Lists that moved elsewhere (the team's went to `teamRecords`) leave no rows behind.
  for (const board of existing) {
    if (!known.has(board.list)) await ctx.db.delete("scoringBoards", board._id);
  }
  for (const split of ["regular", "postseason"] as const) {
    for (const list of SCORING_LIST_KEYS) {
      const top = boards[split][list] ?? [];
      const current = stored.get(`${split}|${list}`);
      if (top.length === 0) {
        if (current) await ctx.db.delete("scoringBoards", current._id);
      } else if (!current) {
        await ctx.db.insert("scoringBoards", { franchiseId: franchise._id, split, list, top });
      } else if (JSON.stringify(current.top) !== JSON.stringify(top)) {
        await ctx.db.patch("scoringBoards", current._id, { top });
      }
    }
  }
}

type NewMilestone = Pick<Doc<"milestones">, "key" | "kind" | "title" | "playerId" | "statKey" | "value">;

/** A touchdown is a player's first when the career totals hold none beyond this game's. */
async function isFirstTouchdown(ctx: QueryCtx, game: Doc<"games">, playerId: Id<"players">) {
  const count = (stats: Record<string, number> | undefined) =>
    SCORED_TD_STATS.reduce((n, key) => n + (stats?.[key] ?? 0), 0);
  const rows = await ctx.db
    .query("careerPlayerStats")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .take(MAX_CAREER_ROWS);
  const line = await ctx.db
    .query("gameStatLines")
    .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", game._id).eq("playerId", playerId))
    .first();
  return rows.reduce((n, r) => n + count(r.totals), 0) - count(line?.stats as StatLine | undefined) <= 0;
}

async function gameMilestones(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  game: Doc<"games">,
  games: readonly Scored[],
  existing: readonly Doc<"milestones">[],
): Promise<NewMilestone[]> {
  const index = games.findIndex((g) => g.gameId === game._id);
  const scored = games[index];
  if (!scored) return [];
  const ours = scored.plays.filter((p) => p.teamId === franchise.userTeamId);
  const earlier = games
    .slice(0, index)
    .flatMap((g) => g.plays.filter((p) => p.teamId === franchise.userTeamId));
  const before = new Map(connections(earlier).map((c) => [`${c.passerId}|${c.playerId}`, c.touchdowns]));
  const players = await playersById(
    ctx,
    ours.flatMap((p) => [p.playerId, p.passerId].filter((id): id is Id<"players"> => id !== undefined)),
  );
  const nameOf = (id: Id<"players">) => players.get(id)?.displayName ?? "Unknown player";
  const out: NewMilestone[] = [];

  const flow = gameFlow(scored.plays);
  const userSide = game.userIsHome ? "home" : "away";
  const winner = flow.winner === userSide ? flow.gameWinner : null;
  if (winner?.playerId) {
    out.push({
      key: `${winner.playerId}:game_winner`,
      kind: "game_winner",
      playerId: winner.playerId,
      title: `${nameOf(winner.playerId)}: game-winning score`,
    });
  }
  const scorers = new Set(ours.flatMap((p) => (p.playerId && isTouchdown(p.kind) ? [p.playerId] : [])));
  for (const playerId of scorers) {
    const key = `${playerId}:first_td`;
    // Once set it stands: a later game in the totals must not take it back on a recommit.
    if (existing.some((m) => m.key === key) || (await isFirstTouchdown(ctx, game, playerId))) {
      out.push({
        key,
        kind: "first_td",
        playerId,
        title: `${nameOf(playerId)}: first career touchdown`,
      });
    }
  }
  for (const pair of connections(ours)) {
    const had = before.get(`${pair.passerId}|${pair.playerId}`) ?? 0;
    for (const mark of connectionMarksCrossed(had, had + pair.touchdowns)) {
      out.push({
        key: `connection:${pair.passerId}:${pair.playerId}:${mark}`,
        kind: "connection",
        playerId: pair.playerId,
        value: mark,
        title: `${nameOf(pair.passerId)} to ${nameOf(pair.playerId)}: ${mark} touchdowns`,
      });
    }
  }
  return out;
}

export const afterPlays = internalMutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get("games", gameId);
    if (!game) return null;
    const franchise = must(await ctx.db.get("franchises", game.franchiseId), "Franchise");
    const games = await scoredGames(ctx, franchise._id);
    await writeBoards(ctx, franchise, games);

    const existing = (
      await ctx.db
        .query("milestones")
        .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
        .take(300)
    ).filter((m) => SCORING_MILESTONES.has(m.kind));
    const desired = await gameMilestones(ctx, franchise, game, games, existing);
    const keys = new Set(desired.map((m) => m.key));
    for (const m of existing) if (!keys.has(m.key)) await ctx.db.delete("milestones", m._id);
    const have = new Set(existing.map((m) => m.key));
    for (const m of desired) {
      if (have.has(m.key)) continue;
      await ctx.db.insert("milestones", {
        ...m,
        franchiseId: franchise._id,
        seasonId: game.seasonId,
        weekKey: game.weekKey,
        gameId,
        acknowledged: false,
        detectedAt: Date.now(),
      });
    }
    return null;
  },
});

/** The records alone, for when a game and its plays are gone. */
export const boards = internalMutation({
  args: { franchiseId: v.id("franchises") },
  returns: v.null(),
  handler: async (ctx, { franchiseId }) => {
    const franchise = must(await ctx.db.get("franchises", franchiseId), "Franchise");
    await writeBoards(ctx, franchise, await scoredGames(ctx, franchiseId));
    return null;
  },
});

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());
const vPerson = v.object({ playerId: v.id("players"), name: v.string(), position: vPosition });

/** The scoring records of the franchise, one split at a time, with names and opponents resolved. */
export const records = query({
  args: { split: vStatSplit },
  returns: v.array(
    v.object({
      list: v.string(),
      entries: v.array(
        v.object({
          rank: v.number(),
          value: v.number(),
          player: nullable(vPerson),
          rawName: nullable(v.string()),
          passer: nullable(vPerson),
          year: v.number(),
          gameId: nullable(v.id("games")),
          weekKey: nullable(vWeekKey),
          opponent: nullable(vTeamRef),
          period: nullable(v.number()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { split }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const boards = await ctx.db
      .query("scoringBoards")
      .withIndex("by_franchiseId_and_split_and_list", (q) =>
        q.eq("franchiseId", franchise._id).eq("split", split),
      )
      .take(MAX_BOARDS);
    const [players, teams] = await Promise.all([
      playersById(
        ctx,
        boards.flatMap((b) =>
          b.top.flatMap((e: Entry) =>
            [e.playerId, e.passerId].filter((id): id is Id<"players"> => id !== undefined),
          ),
        ),
      ),
      teamsById(ctx),
    ]);
    const person = (id: Id<"players"> | undefined) => {
      const p = id ? players.get(id) : undefined;
      return p ? { playerId: p._id, name: p.displayName, position: p.position } : null;
    };
    return boards
      .filter((b) => known.has(b.list))
      .map((b) => ({
        list: b.list,
        entries: b.top.map((e, i) => {
          const opponent = e.opponentTeamId ? teams.get(e.opponentTeamId) : undefined;
          return {
            rank: i + 1,
            value: e.value,
            player: person(e.playerId),
            rawName: e.rawName ?? null,
            passer: person(e.passerId),
            year: e.year,
            gameId: e.gameId ?? null,
            weekKey: e.weekKey ?? null,
            opponent: opponent ? toTeamRef(opponent) : null,
            period: e.period ?? null,
          };
        }),
      }));
  },
});
