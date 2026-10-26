import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise } from "../lib/franchise";
import { vPosition } from "../lib/validators";

const MAX_RESULTS = 12;

/** Players whose name matches the text, for pickers (review's player picker, later the palette). */
export const byName = query({
  args: { text: v.string() },
  returns: v.array(v.object({ _id: v.id("players"), displayName: v.string(), position: vPosition })),
  handler: async (ctx, { text }) => {
    await requireOwner(ctx);
    const trimmed = text.trim();
    if (trimmed.length < 2) return [];
    const franchise = await activeFranchise(ctx);
    const players = await ctx.db
      .query("players")
      .withSearchIndex("search_displayName", (q) =>
        q.search("displayName", trimmed).eq("franchiseId", franchise._id),
      )
      .take(MAX_RESULTS);
    return players.map((p) => ({ _id: p._id, displayName: p.displayName, position: p.position }));
  },
});
