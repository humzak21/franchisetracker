/**
 * Review (FEATURES.md 5.11): the screenshots beside the editable draft, edits saved as the user
 * goes, and commit, which writes canonical rows, recomputes aggregates and stores corrections.
 */
import { v } from "convex/values";
import { diffDrafts } from "../../shared/ingestion/diff";
import { blocksCommit } from "../../shared/ingestion/validate";
import { isRowDraft, validateDraft } from "../../shared/ingestion/targets";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vDraft, vDraftWarning, vFieldConfidence, type StoredDraft } from "../lib/draftValidators";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vUploadStatus, vWeekKey } from "../lib/validators";
import { commitBoxScore } from "./commitBoxScore";
import { refreshSeasonRecord, upsertGame } from "./commitGame";
import { commitRows } from "./commitRows";
import { commitTeamStats } from "./commitTeamStats";
import type { StoredRowsDraft } from "./rowCommit";
import { requireSet, setStatus } from "./sets";

/** Corrections stored per commit; a full re-key of a box score is still well under this. */
const MAX_CORRECTIONS = 300;

async function latestExtraction(ctx: QueryCtx, setKey: string) {
  return await ctx.db
    .query("extractions")
    .withIndex("by_setKey", (q) => q.eq("setKey", setKey))
    .order("desc")
    .first();
}

/** The game this set would commit into, for duplicate detection before commit. */
async function existingGame(ctx: QueryCtx, lead: Doc<"uploads">) {
  const game = lead.gameId
    ? await ctx.db.get("games", lead.gameId)
    : lead.seasonId && lead.weekKey
      ? await ctx.db
          .query("games")
          .withIndex("by_seasonId_and_weekKey", (q) =>
            q.eq("seasonId", lead.seasonId!).eq("weekKey", lead.weekKey!),
          )
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
  return {
    _id: game._id,
    opponentAbbr: opponent?.abbr ?? null,
    hasBoxScore: statLine !== null,
    hasTeamStats: teamStats !== null,
  };
}

export const get = query({
  args: { setKey: v.string() },
  returns: v.object({
    setKey: v.string(),
    status: vUploadStatus,
    targetKey: v.union(v.string(), v.null()),
    season: v.union(v.object({ _id: v.id("seasons"), year: v.number() }), v.null()),
    weekKey: v.union(vWeekKey, v.null()),
    error: v.union(v.string(), v.null()),
    /** When the running extraction started, while the set is extracting. */
    extractionStartedAt: v.union(v.number(), v.null()),
    images: v.array(v.object({ _id: v.id("uploads"), url: v.union(v.string(), v.null()) })),
    userTeamAbbr: v.string(),
    game: v.union(
      v.object({
        _id: v.id("games"),
        opponentAbbr: v.union(v.string(), v.null()),
        hasBoxScore: v.boolean(),
        hasTeamStats: v.boolean(),
      }),
      v.null(),
    ),
    extraction: v.union(
      v.object({
        _id: v.id("extractions"),
        model: v.string(),
        draft: vDraft,
        edited: v.boolean(),
        confidence: v.array(vFieldConfidence),
        warnings: v.array(vDraftWarning),
        latencyMs: v.union(v.number(), v.null()),
      }),
      v.null(),
    ),
  }),
  handler: async (ctx, { setKey }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const uploads = (await requireSet(ctx, franchise._id, setKey)).sort(
      (a, b) => a._creationTime - b._creationTime,
    );
    const lead = uploads[0]!;
    const season = lead.seasonId ? await ctx.db.get("seasons", lead.seasonId) : null;
    const userTeam = must(await ctx.db.get("teams", franchise.userTeamId), "User team");
    const extraction = await latestExtraction(ctx, setKey);
    return {
      setKey,
      status: setStatus(uploads),
      targetKey: lead.targetKey ?? null,
      season: season ? { _id: season._id, year: season.year } : null,
      weekKey: lead.weekKey ?? null,
      error: uploads.find((u) => u.error)?.error ?? null,
      extractionStartedAt: uploads.find((u) => u.status === "extracting")?.extractionStartedAt ?? null,
      images: await Promise.all(
        uploads.map(async (u) => ({ _id: u._id, url: await ctx.storage.getUrl(u.storageId) })),
      ),
      userTeamAbbr: userTeam.abbr,
      game: await existingGame(ctx, lead),
      extraction: extraction
        ? {
            _id: extraction._id,
            model: extraction.model,
            draft: extraction.reviewDraft ?? extraction.draft,
            edited: extraction.reviewDraft !== undefined,
            confidence: extraction.confidence,
            warnings: extraction.warnings,
            latencyMs: extraction.latencyMs ?? null,
          }
        : null,
    };
  },
});

async function requireExtraction(ctx: QueryCtx, setKey: string, draft: StoredDraft) {
  const extraction = must(await latestExtraction(ctx, setKey), "Extraction");
  if (extraction.targetKey !== draft.target) throw invalid("The draft does not match this extraction");
  return extraction;
}

/** Saves review edits as they are made, so a review survives a reload or a switch of device. */
export const saveDraft = mutation({
  args: { setKey: v.string(), draft: vDraft },
  returns: v.null(),
  handler: async (ctx, { setKey, draft }) => {
    await requireOwner(ctx);
    const extraction = await requireExtraction(ctx, setKey, draft);
    await ctx.db.patch("extractions", extraction._id, { reviewDraft: draft });
    return null;
  },
});

/** Game numbers stay small; row values include contract money, so their ceiling is higher. */
const finite = (draft: StoredDraft) => {
  if (isRowDraft(draft)) {
    return draft.rows.every((r) =>
      Object.values(r.values).every(
        (v) => typeof v !== "number" || (Number.isFinite(v) && Math.abs(v) < 1e9),
      ),
    );
  }
  const maps =
    draft.target === "game_box_score" ? draft.lines.map((l) => l.stats) : draft.teams.map((t) => t.stats);
  const numbers = [
    ...maps.flatMap((m) => Object.values(m)),
    draft.game.homeScore ?? 0,
    draft.game.awayScore ?? 0,
  ];
  return numbers.every((n) => Number.isFinite(n) && Math.abs(n) < 100_000);
};

/** Writes a game screen into its game and refreshes the season; returns the game. */
async function commitGameDraft(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  lead: Doc<"uploads">,
  draft: Exclude<StoredDraft, StoredRowsDraft>,
) {
  const game = await upsertGame(ctx, franchise, lead, draft.game);
  let playerIds: Id<"players">[] = [];
  switch (draft.target) {
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

export const commit = mutation({
  args: { setKey: v.string(), draft: vDraft },
  returns: v.object({
    gameId: v.optional(v.id("games")),
    playerId: v.optional(v.id("players")),
    /** The next set waiting for review, so an end-of-season pass moves straight on. */
    nextSetKey: v.optional(v.string()),
  }),
  handler: async (ctx, { setKey, draft }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const uploads = await requireSet(ctx, franchise._id, setKey);
    if (uploads.some((u) => u.status === "committed")) throw invalid("This set is already committed");
    if (uploads.some((u) => u.status === "extracting")) throw invalid("Wait for extraction to finish");
    const extraction = await requireExtraction(ctx, setKey, draft);
    if (!finite(draft)) throw invalid("A number in the draft is out of range");
    const errors = validateDraft(draft).filter((w) => w.severity === "error");
    if (blocksCommit(errors)) throw invalid(errors[0]!.message);

    const lead = [...uploads].sort((a, b) => a._creationTime - b._creationTime)[0]!;
    const result: { gameId?: Id<"games">; playerId?: Id<"players"> } = isRowDraft(draft)
      ? await commitRows(ctx, franchise, lead, draft)
      : { gameId: await commitGameDraft(ctx, franchise, lead, draft) };

    for (const change of diffDrafts(extraction.draft, draft).slice(0, MAX_CORRECTIONS)) {
      await ctx.db.insert("corrections", {
        franchiseId: franchise._id,
        targetKey: extraction.targetKey,
        fieldPath: change.path,
        extractedValue: change.from,
        correctedValue: change.to,
        uploadId: lead._id,
        extractionId: extraction._id,
        usedAsExample: true,
      });
    }
    await ctx.db.patch("extractions", extraction._id, { reviewDraft: draft });
    for (const upload of uploads) {
      await ctx.db.patch("uploads", upload._id, {
        status: "committed",
        error: undefined,
        ...(result.gameId ? { gameId: result.gameId } : {}),
      });
    }
    const next = await ctx.db
      .query("uploads")
      .withIndex("by_franchiseId_and_status", (q) =>
        q.eq("franchiseId", franchise._id).eq("status", "review"),
      )
      .first();
    return { ...result, nextSetKey: next?.setKey };
  },
});
