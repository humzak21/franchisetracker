import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { startImport } from "../history/importJob";
import { createFranchise } from "./create";

/**
 * Franchise setup (FEATURES.md 5.0): the owner names the franchise, picks the team and first
 * season. Real NFL history before that season starts importing in the background (4.8).
 */
export const create = mutation({
  args: { name: v.string(), teamAbbr: v.string(), startYear: v.number() },
  returns: v.id("franchises"),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const { franchiseId } = await createFranchise(ctx, args);
    await startImport(ctx, franchiseId);
    return franchiseId;
  },
});
