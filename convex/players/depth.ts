/** The depth chart (FEATURES.md 5.3): one position's order, set by hand after a roster page. */
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";

/** More players than a position ever carries. */
const MAX_AT_POSITION = 40;

/** Numbers the entries 1, 2, 3 in the order given. They must be one team's, one position, one season. */
export const reorder = mutation({
  args: { entryIds: v.array(v.id("rosterEntries")) },
  returns: v.null(),
  handler: async (ctx, { entryIds }) => {
    await requireOwner(ctx);
    if (entryIds.length > MAX_AT_POSITION) throw invalid("That is too many players for one position");
    const franchise = await activeFranchise(ctx);
    const entries = await Promise.all(
      entryIds.map(async (id) => must(await ctx.db.get("rosterEntries", id), "Roster entry")),
    );
    const [first] = entries;
    const together = entries.every(
      (e) =>
        e.franchiseId === franchise._id &&
        e.seasonId === first?.seasonId &&
        e.teamId === first.teamId &&
        e.position === first.position,
    );
    if (!together) throw invalid("A depth chart orders one team's players at one position");
    for (const [index, entry] of entries.entries()) {
      await ctx.db.patch("rosterEntries", entry._id, { depthSlot: index + 1 });
    }
    return null;
  },
});
