/**
 * Committing a reviewed screenshot set: the draft into canonical rows, the user's fixes into
 * corrections, and the set's uploads marked committed. Review commits one set; the weekly awards
 * batch commits every set that needs nothing more.
 */
import { diffDrafts } from "../../shared/ingestion/diff";
import { deriveDraft } from "../../shared/ingestion/normalize";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { StoredDraft } from "../lib/draftValidators";
import { invalid, must } from "../lib/errors";
import { commitDraft, type DraftCommitResult } from "./commitDraft";
import { requireSet } from "./sets";

/** Corrections stored per commit; a full re-key of a box score is still well under this. */
const MAX_CORRECTIONS = 300;

export async function latestExtraction(ctx: QueryCtx, setKey: string) {
  return await ctx.db
    .query("extractions")
    .withIndex("by_setKey", (q) => q.eq("setKey", setKey))
    .order("desc")
    .first();
}

export async function requireExtraction(ctx: QueryCtx, setKey: string, draft: StoredDraft) {
  const extraction = must(await latestExtraction(ctx, setKey), "Extraction");
  if (extraction.targetKey !== draft.target) throw invalid("The draft does not match this extraction");
  return extraction;
}

export async function commitSet(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  setKey: string,
  submitted: StoredDraft,
): Promise<DraftCommitResult> {
  const draft = deriveDraft(submitted);
  const uploads = await requireSet(ctx, franchise._id, setKey);
  if (uploads.some((u) => u.status === "committed")) throw invalid("This set is already committed");
  if (uploads.some((u) => u.status === "extracting")) throw invalid("Wait for extraction to finish");
  const extraction = await requireExtraction(ctx, setKey, draft);
  const lead = [...uploads].sort((a, b) => a._creationTime - b._creationTime)[0]!;
  const result = await commitDraft(ctx, franchise, lead, draft);

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
  return result;
}
