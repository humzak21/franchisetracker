import { v } from "convex/values";
import { usageByModel } from "../../shared/ingestion/usage";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vTargetKey } from "../lib/draftValidators";
import { activeFranchise } from "../lib/franchise";

/** The extractions the panel sums: recent enough to matter, few enough for one read. */
const WINDOW = 300;
const RECENT = 20;

/** Usage and cost panel (FEATURES.md 5.11): tokens, latency and cost per model, and the latest runs. */
export const summary = query({
  args: {},
  returns: v.object({
    window: v.number(),
    byModel: v.array(
      v.object({
        model: v.string(),
        extractions: v.number(),
        tokens: v.number(),
        costUsd: v.union(v.number(), v.null()),
        avgLatencyMs: v.union(v.number(), v.null()),
      }),
    ),
    recent: v.array(
      v.object({
        _id: v.id("extractions"),
        at: v.number(),
        setKey: v.string(),
        targetKey: vTargetKey,
        model: v.string(),
        tokens: v.union(v.number(), v.null()),
        costUsd: v.union(v.number(), v.null()),
        latencyMs: v.union(v.number(), v.null()),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const rows = await ctx.db
      .query("extractions")
      .withIndex("by_franchiseId", (q) => q.eq("franchiseId", franchise._id))
      .order("desc")
      .take(WINDOW);
    return {
      window: rows.length,
      byModel: usageByModel(
        rows.map((r) => ({
          model: r.model,
          tokens: r.tokenUsage?.total,
          costUsd: r.tokenUsage?.costUsd,
          latencyMs: r.latencyMs,
        })),
      ),
      recent: rows.slice(0, RECENT).map((r) => ({
        _id: r._id,
        at: r._creationTime,
        setKey: r.setKey,
        targetKey: r.targetKey,
        model: r.model,
        tokens: r.tokenUsage?.total ?? null,
        costUsd: r.tokenUsage?.costUsd ?? null,
        latencyMs: r.latencyMs ?? null,
      })),
    };
  },
});
