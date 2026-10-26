import { v } from "convex/values";
import { isStatKey, STAT_REGISTRY } from "../../shared/stats";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";

const vTier = v.object({ tier1: v.number(), tier2: v.optional(v.number()) });

/**
 * Replaces the elite highlight overrides (Settings → Highlights). Only stats that differ from
 * the registry defaults are sent; an empty record restores every default.
 */
export const setThresholds = mutation({
  args: { overrides: v.record(v.string(), vTier) },
  returns: v.null(),
  handler: async (ctx, { overrides }) => {
    await requireOwner(ctx);
    for (const [key, { tier1, tier2 }] of Object.entries(overrides)) {
      if (!isStatKey(key)) throw invalid(`Unknown stat "${key}"`);
      if (![tier1, tier2 ?? tier1].every((n) => Number.isFinite(n) && n >= 0 && n < 1_000_000)) {
        throw invalid(`${STAT_REGISTRY[key].label}: thresholds must be positive numbers`);
      }
      const higher = STAT_REGISTRY[key].better === "higher";
      if (tier2 !== undefined && (higher ? tier2 <= tier1 : tier2 >= tier1)) {
        throw invalid(
          `${STAT_REGISTRY[key].label}: the second tier must be ${higher ? "above" : "below"} the first`,
        );
      }
    }
    const franchise = await activeFranchise(ctx);
    await ctx.db.patch("franchises", franchise._id, {
      settings: { ...franchise.settings, thresholdOverrides: overrides },
    });
    return null;
  },
});
