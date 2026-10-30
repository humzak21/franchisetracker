/**
 * Saving, committing and discarding a manual entry. Commit goes through the same function as a
 * reviewed extraction; there was no model reading, so nothing is stored as a correction.
 */
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vDraft, type StoredDraft } from "../lib/draftValidators";
import { invalid } from "../lib/errors";
import { commitDraft } from "./commitDraft";
import { requireManualDraft } from "./manual";

function requireOpen(entry: Doc<"manualDrafts">, draft?: StoredDraft) {
  if (entry.status !== "open") throw invalid("This entry is already committed");
  if (draft && draft.target !== entry.targetKey) throw invalid("The draft does not match this entry");
}

/** Saves edits as they are made, so an entry survives a reload or a switch of device; a discarded entry is a no-op. */
export const saveDraft = mutation({
  args: { draftId: v.id("manualDrafts"), draft: vDraft },
  returns: v.null(),
  handler: async (ctx, { draftId, draft }) => {
    await requireOwner(ctx);
    // Discarded while an edit was on its way (the save timer fires after Discard): nothing to keep.
    if (!(await ctx.db.get("manualDrafts", draftId))) return null;
    const { entry } = await requireManualDraft(ctx, draftId);
    requireOpen(entry, draft);
    await ctx.db.patch("manualDrafts", entry._id, { draft });
    return null;
  },
});

export const commit = mutation({
  args: { draftId: v.id("manualDrafts"), draft: vDraft },
  returns: v.object({ gameId: v.optional(v.id("games")), playerId: v.optional(v.id("players")) }),
  handler: async (ctx, { draftId, draft }) => {
    await requireOwner(ctx);
    const { franchise, entry } = await requireManualDraft(ctx, draftId);
    requireOpen(entry, draft);
    const result = await commitDraft(ctx, franchise, entry, draft, "manual");
    await ctx.db.patch("manualDrafts", entry._id, {
      draft,
      status: "committed",
      committedAt: Date.now(),
      ...(result.gameId ? { gameId: result.gameId } : {}),
    });
    return result;
  },
});

/** Throws an open entry away; nothing it held was written anywhere else. */
export const discard = mutation({
  args: { draftId: v.id("manualDrafts") },
  returns: v.null(),
  handler: async (ctx, { draftId }) => {
    await requireOwner(ctx);
    const { entry } = await requireManualDraft(ctx, draftId);
    requireOpen(entry);
    await ctx.db.delete("manualDrafts", entry._id);
    return null;
  },
});
