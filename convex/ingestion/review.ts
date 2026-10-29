/**
 * Review (FEATURES.md 5.11): the screenshots beside the editable draft, edits saved as the user
 * goes, and commit, which writes canonical rows, recomputes aggregates and stores corrections.
 */
import { v } from "convex/values";
import { deriveDraft } from "../../shared/ingestion/normalize";
import { rememberPlayer } from "./playerAssignments";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vDraft, vDraftWarning, vFieldConfidence } from "../lib/draftValidators";
import { must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vUploadStatus, vWeekKey } from "../lib/validators";
import { existingGame, vExistingGame } from "./commitDraft";
import { commitSet, latestExtraction, requireExtraction } from "./commitSet";
import { requireSet, setStatus } from "./sets";

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
    game: vExistingGame,
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

/** Saves review edits as they are made, so a review survives a reload or a switch of device. */
export const saveDraft = mutation({
  args: { setKey: v.string(), draft: vDraft },
  returns: v.null(),
  handler: async (ctx, { setKey, draft: submitted }) => {
    const draft = deriveDraft(submitted);
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const uploads = await requireSet(ctx, franchise._id, setKey);
    const extraction = await requireExtraction(ctx, setKey, draft);
    const previous = extraction.reviewDraft ?? extraction.draft;
    const seasonId = uploads[0]?.seasonId;
    if (seasonId) {
      const metaTeam = "rows" in draft && typeof draft.meta.team === "string" ? draft.meta.team : null;
      const userTeam = await ctx.db.get("teams", franchise.userTeamId);
      const entries = "lines" in draft ? draft.lines : "rows" in draft ? draft.rows : [];
      const prior = "lines" in previous ? previous.lines : "rows" in previous ? previous.rows : [];
      for (const row of entries) {
        const old = prior.find((r) => r.id === row.id);
        const teamAbbr = row.teamAbbr ?? metaTeam ?? ("rows" in draft ? userTeam?.abbr : null);
        if (
          row.playerId &&
          row.name &&
          teamAbbr &&
          (row.playerId !== old?.playerId || row.teamAbbr !== old?.teamAbbr)
        ) {
          await rememberPlayer(ctx, {
            franchiseId: franchise._id,
            seasonId,
            teamAbbr,
            name: row.name,
            playerId: row.playerId,
          });
        }
      }
    }
    await ctx.db.patch("extractions", extraction._id, { reviewDraft: draft });
    return null;
  },
});

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
    const result = await commitSet(ctx, franchise, setKey, draft);
    const next = await ctx.db
      .query("uploads")
      .withIndex("by_franchiseId_and_status", (q) =>
        q.eq("franchiseId", franchise._id).eq("status", "review"),
      )
      .first();
    return { ...result, nextSetKey: next?.setKey };
  },
});
