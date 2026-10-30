/**
 * The commit review and manual entry share: check the draft, write it into the game, season or
 * week its context names, and refresh what depends on it. Callers own their bookkeeping
 * (upload statuses and corrections for screenshots, the entry's status for manual entry).
 */
import { v } from "convex/values";
import { deriveDraft } from "../../shared/ingestion/normalize";
import { blocksCommit } from "../../shared/ingestion/validate";
import { INGESTION_TARGETS, isRowDraft, validateDraft } from "../../shared/ingestion/targets";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { StoredDraft } from "../lib/draftValidators";
import { invalid } from "../lib/errors";
import { rowGameContext } from "../lib/gameContext";
import { commitBoxScore } from "./commitBoxScore";
import { refreshSeasonRecord, upsertGame, type DraftContext } from "./commitGame";
import { commitRows } from "./commitRows";
import { commitPlays } from "./commitScoringPlays";
import { commitTeamStats } from "./commitTeamStats";
import type { StoredRowsDraft } from "./rowCommit";

export type DraftCommitResult = { gameId?: Id<"games">; playerId?: Id<"players"> };

/** Game numbers stay small; row values include contract money, so their ceiling is higher. */
const finite = (draft: StoredDraft) => {
  if (isRowDraft(draft)) {
    return draft.rows.every((r) =>
      Object.values(r.values).every(
        (v) => typeof v !== "number" || (Number.isFinite(v) && Math.abs(v) < 1e9),
      ),
    );
  }
  const maps = [
    ...("lines" in draft ? draft.lines.map((l) => l.stats) : []),
    ...("teams" in draft ? draft.teams.map((t) => t.stats) : []),
  ];
  const plays = "plays" in draft ? (draft.plays ?? []) : [];
  const numbers = [
    ...maps.flatMap((m) => Object.values(m)),
    ...plays.flatMap((p) => Object.values(p.values).filter((v) => typeof v === "number")),
    draft.game.homeScore ?? 0,
    draft.game.awayScore ?? 0,
  ];
  return numbers.every((n) => Number.isFinite(n) && Math.abs(n) < 100_000);
};

/** Writes a game screen into its game and refreshes the season; returns the game. */
async function commitGameDraft(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  context: DraftContext,
  draft: Exclude<StoredDraft, StoredRowsDraft>,
) {
  const game = await upsertGame(ctx, franchise, context, draft.game);
  let playerIds: Id<"players">[] = [];
  switch (draft.target) {
    case "game_log":
      if (draft.lines.length > 0) playerIds = await commitBoxScore(ctx, franchise, game, draft);
      await commitTeamStats(ctx, franchise, game, draft);
      // After the box score, so a name reaches the players it just added.
      await commitPlays(
        ctx,
        franchise,
        game,
        (draft.plays ?? []).filter((p) => p.accepted),
      );
      break;
    case "game_box_score":
      playerIds = await commitBoxScore(ctx, franchise, game, draft);
      break;
    case "team_game_stats":
      await commitTeamStats(ctx, franchise, game, draft);
      break;
  }
  await refreshSeasonRecord(ctx, game.seasonId);
  await ctx.scheduler.runAfter(0, internal.stats.refresh.afterGame, { gameId: game._id, playerIds });
  return game._id;
}

/** Checks a draft and writes it. Throws, writing nothing, when a number is out of range or an error stands. */
export async function commitDraft(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  context: DraftContext,
  submitted: StoredDraft,
): Promise<DraftCommitResult> {
  const draft = deriveDraft(submitted);
  if (!finite(draft)) throw invalid("A number in the draft is out of range");
  const readsGame = isRowDraft(draft)
    ? INGESTION_TARGETS[draft.target].scope === "game"
    : draft.target === "game_log";
  const game = readsGame
    ? await rowGameContext(ctx, (await existingGame(ctx, context))?._id ?? null)
    : undefined;
  const errors = validateDraft(draft, game).filter((w) => w.severity === "error");
  if (blocksCommit(errors)) throw invalid(errors[0]!.message);
  return isRowDraft(draft)
    ? await commitRows(ctx, franchise, context, draft)
    : { gameId: await commitGameDraft(ctx, franchise, context, draft) };
}

export const vExistingGame = v.union(
  v.object({
    _id: v.id("games"),
    opponentAbbr: v.union(v.string(), v.null()),
    hasBoxScore: v.boolean(),
    hasTeamStats: v.boolean(),
    hasScoringPlays: v.boolean(),
  }),
  v.null(),
);

/** The game a draft would commit into, for the warning that committing replaces what it has. */
export async function existingGame(ctx: QueryCtx, context: DraftContext) {
  const { gameId, seasonId, weekKey } = context;
  const game = gameId
    ? await ctx.db.get("games", gameId)
    : seasonId && weekKey
      ? await ctx.db
          .query("games")
          .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
          .first()
      : null;
  if (!game || game.status === "bye") return null;
  const opponent = game.opponentTeamId ? await ctx.db.get("teams", game.opponentTeamId) : null;
  const statLine = await ctx.db
    .query("gameStatLines")
    .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id))
    .first();
  const teamStats = await ctx.db
    .query("gameTeamStats")
    .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id))
    .first();
  const play = await ctx.db
    .query("scoringPlays")
    .withIndex("by_gameId_and_order", (q) => q.eq("gameId", game._id))
    .first();
  return {
    _id: game._id,
    opponentAbbr: opponent?.abbr ?? null,
    hasBoxScore: statLine !== null,
    hasTeamStats: teamStats !== null,
    hasScoringPlays: play !== null,
  };
}
