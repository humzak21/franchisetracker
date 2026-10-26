/**
 * Correction memory (FEATURES.md 5.11): what review changed, per target. The newest corrections
 * marked as examples go into that target's prompt; this is where they are seen and pruned.
 */
import { v } from "convex/values";
import { TARGET_KEYS } from "../../shared/ingestion/targets";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vTargetKey } from "../lib/draftValidators";
import { must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vScalar } from "../lib/validators";

/** Shown per target; the prompt only ever uses the newest dozen. */
const PER_TARGET = 50;
const PRUNE_BATCH = 500;

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      targetKey: vTargetKey,
      corrections: v.array(
        v.object({
          _id: v.id("corrections"),
          at: v.number(),
          fieldPath: v.string(),
          extracted: vScalar,
          corrected: vScalar,
          usedAsExample: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const groups = await Promise.all(
      TARGET_KEYS.map(async (targetKey) => {
        const rows = await ctx.db
          .query("corrections")
          .withIndex("by_franchiseId_and_targetKey_and_usedAsExample", (q) =>
            q.eq("franchiseId", franchise._id).eq("targetKey", targetKey),
          )
          .order("desc")
          .take(PER_TARGET);
        return {
          targetKey,
          corrections: rows
            .sort((a, b) => b._creationTime - a._creationTime)
            .map((c) => ({
              _id: c._id,
              at: c._creationTime,
              fieldPath: c.fieldPath,
              extracted: c.extractedValue,
              corrected: c.correctedValue,
              usedAsExample: c.usedAsExample,
            })),
        };
      }),
    );
    return groups.filter((g) => g.corrections.length > 0);
  },
});

/** Keeps a correction but stops showing it to the model (a one-off, or a change of mind). */
export const setUsed = mutation({
  args: { correctionId: v.id("corrections"), used: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { correctionId, used }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("corrections", correctionId), "Correction");
    await ctx.db.patch("corrections", correctionId, { usedAsExample: used });
    return null;
  },
});

export const remove = mutation({
  args: { correctionId: v.id("corrections") },
  returns: v.null(),
  handler: async (ctx, { correctionId }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("corrections", correctionId), "Correction");
    await ctx.db.delete("corrections", correctionId);
    return null;
  },
});

/** Clears a target's corrections, a batch at a time; returns how many are left. */
export const prune = mutation({
  args: { targetKey: vTargetKey },
  returns: v.number(),
  handler: async (ctx, { targetKey }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const rows = await ctx.db
      .query("corrections")
      .withIndex("by_franchiseId_and_targetKey_and_usedAsExample", (q) =>
        q.eq("franchiseId", franchise._id).eq("targetKey", targetKey),
      )
      .take(PRUNE_BATCH + 1);
    for (const row of rows.slice(0, PRUNE_BATCH)) await ctx.db.delete("corrections", row._id);
    return Math.max(0, rows.length - PRUNE_BATCH);
  },
});
