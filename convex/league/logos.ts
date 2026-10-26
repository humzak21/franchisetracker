/** ESPN team logos cached in Convex storage, served to every `TeamLogo` through one query. */
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";

const MAX_TEAMS = 64;

/** Cached logo URLs keyed by team abbreviation; teams without one fall back to the monogram shield. */
export const urls = query({
  args: {},
  returns: v.record(v.string(), v.string()),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const teams = await ctx.db.query("teams").take(MAX_TEAMS);
    const out: Record<string, string> = {};
    for (const team of teams) {
      const url = team.logoStorageId ? await ctx.storage.getUrl(team.logoStorageId) : null;
      if (url) out[team.abbr] = url;
    }
    return out;
  },
});

export const missing = internalQuery({
  args: {},
  returns: v.array(v.object({ teamId: v.id("teams"), abbr: v.string() })),
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").take(MAX_TEAMS);
    return teams.filter((t) => !t.logoStorageId).map((t) => ({ teamId: t._id, abbr: t.abbr }));
  },
});

export const save = internalMutation({
  args: { teamId: v.id("teams"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { teamId, storageId }) => {
    const team = await ctx.db.get("teams", teamId);
    if (!team || team.logoStorageId) {
      // Another run cached it first; drop the duplicate upload.
      await ctx.storage.delete(storageId);
      return null;
    }
    await ctx.db.patch("teams", teamId, { logoStorageId: storageId });
    return null;
  },
});
