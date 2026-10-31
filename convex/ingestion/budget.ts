/** The monthly extraction budget: setting it, what it stands at, and letting held sets go again. */
import { v } from "convex/values";
import { budgetLevel, usageMonth } from "../../shared/ingestion/budget";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { budgetSpent, monthSpend } from "../lib/usage";
import { readyToExtract, setUploads, startExtraction } from "./sets";

/** Sets waiting at once: a whole season's capture, with headroom. */
const MAX_QUEUED = 200;

async function heldSets(ctx: MutationCtx, franchise: Doc<"franchises">) {
  const queued = await ctx.db
    .query("uploads")
    .withIndex("by_franchiseId_and_status", (q) => q.eq("franchiseId", franchise._id).eq("status", "queued"))
    .take(MAX_QUEUED);
  return [...new Set(queued.flatMap((u) => (u.hold === "budget" && u.setKey ? [u.setKey] : [])))];
}

/** Starts what the budget held, as long as there is room. Only the active franchise can extract. */
async function releaseHeld(ctx: MutationCtx, franchise: Doc<"franchises">) {
  if (!franchise.isActive) return;
  for (const key of await heldSets(ctx, franchise)) {
    if (await budgetSpent(ctx, franchise)) return;
    const set = await setUploads(ctx, franchise._id, key);
    if (set[0] && readyToExtract(set[0])) await startExtraction(ctx, set);
  }
}

export const status = query({
  args: {},
  returns: v.object({
    month: v.string(),
    budgetUsd: v.union(v.number(), v.null()),
    spentUsd: v.number(),
    level: v.union(v.literal("none"), v.literal("ok"), v.literal("warn"), v.literal("over")),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const spentUsd = await monthSpend(ctx, franchise._id);
    const budget = franchise.settings.monthlyBudgetUsd;
    return {
      month: usageMonth(Date.now()),
      budgetUsd: budget ?? null,
      spentUsd,
      level: budgetLevel(spentUsd, budget),
    };
  },
});

/** Sets the limit, or with null removes it. Room to spend starts anything that was held. */
export const set = mutation({
  args: { budgetUsd: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { budgetUsd }) => {
    await requireOwner(ctx);
    if (budgetUsd !== null && !(budgetUsd > 0 && budgetUsd < 100_000)) {
      throw invalid("A budget is a dollar amount above zero");
    }
    const franchise = await activeFranchise(ctx);
    const { monthlyBudgetUsd: _old, ...settings } = franchise.settings;
    const updated = {
      ...franchise,
      settings: budgetUsd === null ? settings : { ...settings, monthlyBudgetUsd: budgetUsd },
    };
    await ctx.db.patch("franchises", franchise._id, { settings: updated.settings });
    await releaseHeld(ctx, updated);
    return null;
  },
});

/** The nightly look at held sets, which is how a new month starts them. */
export const release = internalMutation({
  args: { franchiseId: v.id("franchises") },
  returns: v.null(),
  handler: async (ctx, { franchiseId }) => {
    const franchise = await ctx.db.get("franchises", franchiseId);
    if (franchise) await releaseHeld(ctx, franchise);
    return null;
  },
});
