/**
 * Manual entry: any screenshot target typed in by hand. An entry starts as the target's empty
 * draft filed under a game, week or season, is edited in the review editors, and commits
 * through the same function as a reviewed extraction (`./manualCommit.ts`).
 */
import { v } from "convex/values";
import { emptyDraft, INGESTION_TARGETS, type TargetKey } from "../../shared/ingestion/targets";
import type { GameHeader } from "../../shared/ingestion/types";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vDraft, vTargetKey } from "../lib/draftValidators";
import { invalid, must, notFound } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { literals, vWeekKey } from "../lib/validators";
import { MANUAL_DRAFT_STATUSES } from "../../shared/ingestion/manual";
import type { DraftContext } from "./commitGame";
import { existingGame, vExistingGame } from "./commitDraft";

/** Entries in progress the inbox lists; more than this open at once is abandoned work. */
const MAX_OPEN = 50;

/** The entry, if it is the active franchise's. */
export async function requireManualDraft(ctx: QueryCtx, draftId: Id<"manualDrafts">) {
  const franchise = await activeFranchise(ctx);
  const entry = await ctx.db.get("manualDrafts", draftId);
  if (!entry || entry.franchiseId !== franchise._id) throw notFound("Manual entry");
  return { franchise, entry };
}

async function abbrOf(ctx: QueryCtx, teamId: Id<"teams"> | undefined) {
  return teamId ? ((await ctx.db.get("teams", teamId))?.abbr ?? null) : null;
}

/** A scheduled or played game's teams and score, as the header a game draft starts from. */
async function headerOf(ctx: QueryCtx, game: Doc<"games">): Promise<GameHeader | null> {
  if (game.status === "bye" || !game.homeTeamId || !game.awayTeamId) return null;
  return {
    homeAbbr: await abbrOf(ctx, game.homeTeamId),
    awayAbbr: await abbrOf(ctx, game.awayTeamId),
    homeScore: game.homeScore ?? null,
    awayScore: game.awayScore ?? null,
    overtime: game.overtime ?? false,
    lineScore: game.lineScore ?? null,
  };
}

/** Checks the context a target needs, like tagging a screenshot: a game, a season and week, or a season. */
async function contextFor(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
  targetKey: TargetKey,
  args: DraftContext,
): Promise<{ context: DraftContext; game: Doc<"games"> | null }> {
  if (args.gameId) {
    const game = must(await ctx.db.get("games", args.gameId), "Game");
    if (game.franchiseId !== franchise._id) throw notFound("Game");
    return { context: { gameId: game._id, seasonId: game.seasonId, weekKey: game.weekKey }, game };
  }
  const season = args.seasonId ? await ctx.db.get("seasons", args.seasonId) : null;
  if (!season || season.franchiseId !== franchise._id) throw invalid("Pick a season first");
  const { scope } = INGESTION_TARGETS[targetKey];
  if (scope === "season") return { context: { seasonId: season._id }, game: null };
  const { weekKey } = args;
  if (!weekKey) throw invalid("Pick a week first");
  const game = await ctx.db
    .query("games")
    .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", season._id).eq("weekKey", weekKey))
    .first();
  return { context: { seasonId: season._id, weekKey }, game };
}

/** Starts an entry: the target's empty draft, filed under its context. Returns the entry. */
export const create = mutation({
  args: {
    targetKey: vTargetKey,
    seasonId: v.optional(v.id("seasons")),
    weekKey: v.optional(vWeekKey),
    gameId: v.optional(v.id("games")),
  },
  returns: v.id("manualDrafts"),
  handler: async (ctx, { targetKey, ...args }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const { context, game } = await contextFor(ctx, franchise, targetKey, args);
    const userTeam = must(await ctx.db.get("teams", franchise.userTeamId), "User team");
    const header = game && INGESTION_TARGETS[targetKey].kind === "game" ? await headerOf(ctx, game) : null;
    return await ctx.db.insert("manualDrafts", {
      franchiseId: franchise._id,
      targetKey,
      ...context,
      draft: emptyDraft(targetKey, { userTeamAbbr: userTeam.abbr, game: header }),
      status: "open",
      createdAt: Date.now(),
    });
  },
});

/** The entry and where it is filed; null once discarded (or if it is another franchise's). */
export const get = query({
  args: { draftId: v.id("manualDrafts") },
  returns: v.union(
    v.object({
      _id: v.id("manualDrafts"),
      targetKey: vTargetKey,
      status: literals(MANUAL_DRAFT_STATUSES),
      season: v.union(v.object({ _id: v.id("seasons"), year: v.number() }), v.null()),
      weekKey: v.union(vWeekKey, v.null()),
      draft: vDraft,
      game: vExistingGame,
    }),
    v.null(),
  ),
  handler: async (ctx, { draftId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const entry = await ctx.db.get("manualDrafts", draftId);
    if (!entry || entry.franchiseId !== franchise._id) return null;
    const season = entry.seasonId ? await ctx.db.get("seasons", entry.seasonId) : null;
    return {
      _id: entry._id,
      targetKey: entry.targetKey,
      status: entry.status,
      season: season ? { _id: season._id, year: season.year } : null,
      weekKey: entry.weekKey ?? null,
      draft: entry.draft,
      game: await existingGame(ctx, entry),
    };
  },
});

/** Entries started and not committed yet, newest first, so the inbox can offer to finish them. */
export const listOpen = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("manualDrafts"),
      targetKey: vTargetKey,
      year: v.union(v.number(), v.null()),
      weekKey: v.union(vWeekKey, v.null()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const open = await ctx.db
      .query("manualDrafts")
      .withIndex("by_franchiseId_and_status", (q) => q.eq("franchiseId", franchise._id).eq("status", "open"))
      .order("desc")
      .take(MAX_OPEN);
    return await Promise.all(
      open.map(async (entry) => ({
        _id: entry._id,
        targetKey: entry.targetKey,
        year: entry.seasonId ? ((await ctx.db.get("seasons", entry.seasonId))?.year ?? null) : null,
        weekKey: entry.weekKey ?? null,
        createdAt: entry.createdAt,
      })),
    );
  },
});

/** What the start screen shows for an entry started from a game: its season, week and opponent. */
export const gameContext = query({
  args: { gameId: v.id("games") },
  returns: v.object({
    seasonId: v.id("seasons"),
    year: v.number(),
    weekKey: vWeekKey,
    opponentAbbr: v.union(v.string(), v.null()),
    userIsHome: v.boolean(),
  }),
  handler: async (ctx, { gameId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const game = await ctx.db.get("games", gameId);
    if (!game || game.franchiseId !== franchise._id) throw notFound("Game");
    const season = must(await ctx.db.get("seasons", game.seasonId), "Season");
    return {
      seasonId: season._id,
      year: season.year,
      weekKey: game.weekKey,
      opponentAbbr: await abbrOf(ctx, game.opponentTeamId),
      userIsHome: game.userIsHome ?? true,
    };
  },
});
