/**
 * Builds the team and all-time records books from scratch, a chain of scheduled steps small
 * enough for one transaction each: clear the boards, every player's career (recomputed on the
 * way, which also records his main team), every season's rows, then every list's placements.
 * Runs after the history import, from the Records screen, or with
 * `npx convex run stats/recordBuild:start`. After that each game updates the books for its
 * players alone (`afterGame`). A newer run supersedes an older one's remaining steps.
 */
import { v } from "convex/values";
import { weekPhase } from "../../shared/domain";
import { RECORD_BOOKS, RECORD_SCOPES, RECORD_STATS, type RecordBook } from "../../shared/stats";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vRecordBook, vRecordScope, vStatSplit } from "../lib/validators";
import { activeFranchise } from "../lib/franchise";
import { mergeBoards, writePlacements, type BoardUpdate, type ListKey } from "./boards";
import { careerBoards, playerBoards, seasonBoards } from "./boardCandidates";
import { franchiseSeasons, type Split } from "./load";

/** Players per step: each reads his season rows and rewrites his career. */
const PLAYER_PAGE = 150;
const SPLITS = ["regular", "postseason"] as const;
const MAX_BOARDS = 1000;
/** Lists whose placements one step rewrites: twenty-odd writes each, well inside a mutation's time. */
const PLACEMENT_CHUNK = 24;
/** Players one step of a game's board update re-enters. */
const GAME_PLAYER_CHUNK = 12;

type BookList = ListKey & { book: RecordBook };

const vListKey = v.object({ split: vStatSplit, scope: vRecordScope, statKey: v.string() });
const vBookList = v.object({ book: vRecordBook, ...vListKey.fields });

/** Every list of every book, in a fixed order the build walks through in chunks. */
const ALL_LISTS: BookList[] = RECORD_BOOKS.flatMap((book) =>
  SPLITS.flatMap((split) =>
    RECORD_SCOPES.flatMap((scope) => RECORD_STATS.map((statKey) => ({ book, split, scope, statKey }))),
  ),
);

/** Rewrites placements for some lists, a chunk per step. */
export const placements = internalMutation({
  args: { franchiseId: v.id("franchises"), lists: v.array(vBookList) },
  returns: v.null(),
  handler: async (ctx, { franchiseId, lists }) => {
    const franchise = await ctx.db.get("franchises", franchiseId);
    if (!franchise) return null;
    for (const { book, ...key } of lists.slice(0, PLACEMENT_CHUNK))
      await writePlacements(ctx, franchise, book, key);
    const rest = lists.slice(PLACEMENT_CHUNK);
    if (rest.length > 0)
      await ctx.scheduler.runAfter(0, internal.stats.recordBuild.placements, { franchiseId, lists: rest });
    return null;
  },
});

const uniqueLists = (lists: readonly BookList[]) => [
  ...new Map(lists.map((l) => [`${l.book}|${l.split}|${l.scope}|${l.statKey}`, l])).values(),
];

async function jobFor(ctx: QueryCtx, franchiseId: Id<"franchises">) {
  return await ctx.db
    .query("recordBuilds")
    .withIndex("by_franchiseId", (q) => q.eq("franchiseId", franchiseId))
    .unique();
}

/**
 * Whether the franchise has built its books. Until then a game has nothing to update: the first
 * build reads everything, games included.
 */
export async function booksBuilt(ctx: QueryCtx, franchiseId: Id<"franchises">): Promise<boolean> {
  return (await jobFor(ctx, franchiseId)) !== null;
}

/** Starts a build, superseding any running one. */
export async function startRecordBuild(ctx: MutationCtx, franchiseId: Id<"franchises">) {
  const job = await jobFor(ctx, franchiseId);
  const run = (job?.run ?? 0) + 1;
  const fields = {
    run,
    status: "running" as const,
    phase: "clear",
    startedAt: Date.now(),
    finishedAt: undefined,
  };
  if (job) await ctx.db.patch("recordBuilds", job._id, fields);
  else await ctx.db.insert("recordBuilds", { franchiseId, ...fields });
  await ctx.scheduler.runAfter(0, internal.stats.recordBuild.step, { franchiseId, run, phase: "clear" });
}

const vPhase = v.union(
  v.literal("clear"),
  v.literal("players"),
  v.literal("seasons"),
  v.literal("placements"),
);

export const step = internalMutation({
  args: {
    franchiseId: v.id("franchises"),
    run: v.number(),
    phase: vPhase,
    cursor: v.optional(v.union(v.string(), v.null())),
    index: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await jobFor(ctx, args.franchiseId);
    const franchise = await ctx.db.get("franchises", args.franchiseId);
    if (!job || job.run !== args.run || !franchise) return null;
    const next = async (phase: typeof args.phase, more: { cursor?: string | null; index?: number } = {}) => {
      await ctx.db.patch("recordBuilds", job._id, { phase });
      await ctx.scheduler.runAfter(0, internal.stats.recordBuild.step, {
        franchiseId: franchise._id,
        run: args.run,
        phase,
        ...more,
      });
    };

    if (args.phase === "clear") {
      const boards = await ctx.db
        .query("recordBoards")
        .withIndex("by_franchiseId_and_book_and_split_and_scope_and_statKey", (q) =>
          q.eq("franchiseId", franchise._id),
        )
        .take(MAX_BOARDS);
      for (const b of boards) await ctx.db.delete("recordBoards", b._id);
      if (boards.length === MAX_BOARDS) await next("clear");
      else await next("players", { cursor: null });
    } else if (args.phase === "players") {
      const page = await ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_lastName", (q) => q.eq("franchiseId", franchise._id))
        .paginate({ numItems: PLAYER_PAGE, cursor: args.cursor ?? null });
      const updates: BoardUpdate[] = [];
      for (const player of page.page) updates.push(...(await careerBoards(ctx, franchise, player)));
      await mergeBoards(ctx, franchise._id, updates);
      if (page.isDone) await next("seasons", { index: 0 });
      else await next("players", { cursor: page.continueCursor });
    } else if (args.phase === "seasons") {
      const seasons = [...(await franchiseSeasons(ctx, franchise._id))].sort((a, b) => a.year - b.year);
      const season = seasons[args.index ?? 0];
      if (!season) await next("placements", { index: 0 });
      else {
        await mergeBoards(ctx, franchise._id, await seasonBoards(ctx, franchise, season));
        await next("seasons", { index: (args.index ?? 0) + 1 });
      }
    } else {
      const offset = args.index ?? 0;
      const chunk = ALL_LISTS.slice(offset, offset + PLACEMENT_CHUNK);
      if (chunk.length === 0) {
        await ctx.db.patch("recordBuilds", job._id, {
          status: "done",
          phase: "done",
          finishedAt: Date.now(),
        });
        return null;
      }
      for (const { book, ...key } of chunk) await writePlacements(ctx, franchise, book, key);
      await next("placements", { index: offset + PLACEMENT_CHUNK });
    }
    return null;
  },
});

/**
 * After a game: the books' entries for its players, from their freshly recomputed rows. Each
 * player's season, single game and career are re-entered, so a correction lands too.
 */
export const afterGame = internalMutation({
  args: {
    gameId: v.id("games"),
    /** Franchise-era lists the game changed, for their placements. */
    franchiseLists: v.optional(v.array(vListKey)),
    /** Players still to re-enter; absent on the first step, which reads them from the box score. */
    playerIds: v.optional(v.array(v.id("players"))),
  },
  returns: v.null(),
  handler: async (ctx, { gameId, franchiseLists = [], playerIds }) => {
    const game = await ctx.db.get("games", gameId);
    if (!game) return null;
    const phase = weekPhase(game.weekKey);
    if (phase !== "regular" && phase !== "postseason") return null;
    const split: Split = phase;
    const [franchise, season] = await Promise.all([
      ctx.db.get("franchises", game.franchiseId),
      ctx.db.get("seasons", game.seasonId),
    ]);
    if (!franchise || !season) return null;
    const players = playerIds ?? [
      ...new Set(
        (
          await ctx.db
            .query("gameStatLines")
            .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", gameId))
            .take(200)
        ).map((l) => l.playerId),
      ),
    ];
    const years = new Map((await franchiseSeasons(ctx, franchise._id)).map((s) => [s._id, s.year]));
    const updates: BoardUpdate[] = [];
    for (const playerId of players.slice(0, GAME_PLAYER_CHUNK)) {
      updates.push(...(await playerBoards(ctx, franchise, season, years, playerId, split)));
    }
    const changed = await mergeBoards(ctx, franchise._id, updates);
    const lists = uniqueLists([
      ...franchiseLists.map((key) => ({ book: "franchise" as const, ...key })),
      ...changed,
    ]);
    if (lists.length > 0) {
      await ctx.scheduler.runAfter(0, internal.stats.recordBuild.placements, {
        franchiseId: franchise._id,
        lists,
      });
    }
    const rest = players.slice(GAME_PLAYER_CHUNK);
    if (rest.length > 0)
      await ctx.scheduler.runAfter(0, internal.stats.recordBuild.afterGame, { gameId, playerIds: rest });
    return null;
  },
});

/** Rebuilds the records books for the active franchise (the Records screen's button). */
export const rebuild = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    await startRecordBuild(ctx, (await activeFranchise(ctx))._id);
    return null;
  },
});

/** CLI entry: `npx convex run stats/recordBuild:start`. */
export const start = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await startRecordBuild(ctx, (await activeFranchise(ctx))._id);
    return null;
  },
});

const vStatus = v.union(
  v.null(),
  v.object({
    status: v.union(v.literal("running"), v.literal("done")),
    phase: v.string(),
    finishedAt: v.optional(v.number()),
  }),
);

async function buildStatus(ctx: QueryCtx) {
  const job = await jobFor(ctx, (await activeFranchise(ctx))._id);
  return job ? { status: job.status, phase: job.phase, finishedAt: job.finishedAt } : null;
}

export const status = query({
  args: {},
  returns: vStatus,
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await buildStatus(ctx);
  },
});

/** The same for setup scripts: the e2e backend waits on it before tests start. */
export const statusForSetup = internalQuery({
  args: {},
  returns: vStatus,
  handler: buildStatus,
});
