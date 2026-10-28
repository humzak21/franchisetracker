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
import { BOARD_BOOKS, keepBest, RECORD_SCOPES, RECORD_STATS, type BoardBook } from "../../shared/stats";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise } from "../lib/franchise";
import { mergeBoards, writePlacements, type BoardUpdate } from "./boards";
import { careerUpdates, leaderUpdates, seasonUpdates, teamCareer } from "./boardCandidates";
import { franchiseSeasons, type Split } from "./load";
import { recomputeCareer } from "./recompute";

const SPLITS = ["regular", "postseason"] as const;
/** Players per step: each reads his season rows and rewrites his career. */
const PLAYER_PAGE = 150;
/** One season of the whole league, both splits, with headroom. */
const MAX_SEASON_ROWS = 8000;
const MAX_LEADERS = 3000;
const MAX_BOARDS = 1000;
/** A player's seasons with every team, playoffs included. */
const MAX_PLAYER_ROWS = 80;

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
      // One book and split per step: every scope and stat of it.
      const books = (["franchise", ...BOARD_BOOKS] as const).flatMap((book) =>
        SPLITS.map((split) => ({ book, split })),
      );
      const at = books[args.index ?? 0];
      if (!at) {
        await ctx.db.patch("recordBuilds", job._id, {
          status: "done",
          phase: "done",
          finishedAt: Date.now(),
        });
        return null;
      }
      for (const scope of RECORD_SCOPES)
        for (const statKey of RECORD_STATS)
          await writePlacements(ctx, franchise, at.book, { split: at.split, scope, statKey });
      await next("placements", { index: (args.index ?? 0) + 1 });
    }
    return null;
  },
});

/** A player's career entries for both books, from a fresh career recompute. */
async function careerBoards(ctx: MutationCtx, franchise: Doc<"franchises">, player: Doc<"players">) {
  const { rows, careers } = await recomputeCareer(ctx, player);
  return SPLITS.flatMap((split) => {
    const league = careers
      .filter((c) => c.split === split)
      .map((c) => ({
        playerId: c.playerId,
        totals: c.totals,
        firstYear: c.firstYear ?? 0,
        lastYear: c.lastYear ?? 0,
        teamId: c.teamId,
      }));
    const team = teamCareer(rows, split, franchise.userTeamId);
    return [...careerUpdates("league", split, league), ...careerUpdates("team", split, team ? [team] : [])];
  });
}

/** A season's season and single-game entries for both books. */
async function seasonBoards(ctx: MutationCtx, franchise: Doc<"franchises">, season: Doc<"seasons">) {
  const [rows, leaders] = await Promise.all([
    ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id))
      .take(MAX_SEASON_ROWS),
    ctx.db
      .query("leagueLeaders")
      .withIndex("by_seasonId_and_statKey_and_rank", (q) => q.eq("seasonId", season._id))
      .take(MAX_LEADERS),
  ]);
  const dated = rows.map((r) => ({ ...r, year: season.year }));
  const ours = dated.filter((r) => r.teamId === franchise.userTeamId);
  const league = SPLITS.flatMap((split) => seasonUpdates("league", split, dated));
  const fromLeaders = leaderUpdates(leaders, season);
  return [
    ...SPLITS.flatMap((split) => seasonUpdates("team", split, ours)),
    // A leaders screen and the captured games can both know a season: the bigger number wins.
    ...league.map((u) => {
      const extra = fromLeaders.find(
        (l) => l.split === u.split && l.scope === u.scope && l.statKey === u.statKey,
      );
      return extra ? { ...u, entries: keepBest([...u.entries, ...extra.entries]) } : u;
    }),
    ...fromLeaders.filter(
      (l) => !league.some((u) => u.split === l.split && u.scope === l.scope && u.statKey === l.statKey),
    ),
  ];
}

/**
 * After a game: the books' entries for its players, from their freshly recomputed rows. Each
 * player's season, single game and career are re-entered, so a correction lands too.
 */
export const afterGame = internalMutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, { gameId }) => {
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
    const lines = await ctx.db
      .query("gameStatLines")
      .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", gameId))
      .take(200);
    const updates: BoardUpdate[] = [];
    for (const playerId of new Set(lines.map((l) => l.playerId))) {
      updates.push(...(await playerBoards(ctx, franchise, season, playerId, split)));
    }
    const changed = await mergeBoards(ctx, franchise._id, updates);
    for (const { book, ...key } of changed) await writePlacements(ctx, franchise, book, key);
    return null;
  },
});

async function playerBoards(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  season: Doc<"seasons">,
  playerId: Id<"players">,
  split: Split,
): Promise<BoardUpdate[]> {
  const [rows, careers] = await Promise.all([
    ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_PLAYER_ROWS),
    ctx.db
      .query("careerPlayerStats")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(4),
  ]);
  const years = new Map((await franchiseSeasons(ctx, franchise._id)).map((s) => [s._id, s.year]));
  const dated = rows.flatMap((r) => (years.has(r.seasonId) ? [{ ...r, year: years.get(r.seasonId)! }] : []));
  const thisSeason = dated.filter((r) => r.seasonId === season._id);
  const career = careers.find((c) => c.split === split);
  const team = teamCareer(dated, split, franchise.userTeamId);
  const books: [BoardBook, typeof thisSeason][] = [
    ["league", thisSeason],
    ["team", thisSeason.filter((r) => r.teamId === franchise.userTeamId)],
  ];
  return [
    ...books.flatMap(([book, inSeason]) => seasonUpdates(book, split, inSeason)),
    ...careerUpdates(
      "league",
      split,
      career
        ? [
            {
              playerId,
              totals: career.totals,
              firstYear: career.firstYear ?? season.year,
              lastYear: career.lastYear ?? season.year,
              teamId: career.teamId,
            },
          ]
        : [],
    ),
    ...careerUpdates("team", split, team ? [team] : []),
  ];
}

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

export const status = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(v.literal("running"), v.literal("done")),
      phase: v.string(),
      finishedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const job = await ctx.db
      .query("recordBuilds")
      .withIndex("by_franchiseId", (q) => q.eq("franchiseId", franchise._id))
      .unique();
    return job ? { status: job.status, phase: job.phase, finishedAt: job.finishedAt } : null;
  },
});
