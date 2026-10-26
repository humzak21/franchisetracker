/** The milestone feed on the dashboard (FEATURES.md 5.1): detected events, acknowledged with one tap. */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vMilestoneKind, vWeekKey } from "../lib/validators";

const FEED_SIZE = 30;

export const feed = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("milestones"),
      kind: vMilestoneKind,
      title: v.string(),
      year: v.union(v.number(), v.null()),
      weekKey: v.union(vWeekKey, v.null()),
      playerId: v.union(v.id("players"), v.null()),
      gameId: v.union(v.id("games"), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const open = await ctx.db
      .query("milestones")
      .withIndex("by_franchiseId_and_acknowledged", (q) =>
        q.eq("franchiseId", franchise._id).eq("acknowledged", false),
      )
      .order("desc")
      .take(FEED_SIZE);
    const years = new Map<string, number>();
    for (const id of new Set(open.map((m) => m.seasonId))) {
      const season = await ctx.db.get("seasons", id);
      if (season) years.set(id, season.year);
    }
    return open.map((m) => ({
      _id: m._id,
      kind: m.kind,
      title: m.title,
      year: years.get(m.seasonId) ?? null,
      weekKey: m.weekKey ?? null,
      playerId: m.playerId ?? null,
      gameId: m.gameId ?? null,
    }));
  },
});

export const acknowledge = mutation({
  args: { milestoneIds: v.array(v.id("milestones")) },
  returns: v.null(),
  handler: async (ctx, { milestoneIds }) => {
    await requireOwner(ctx);
    for (const id of milestoneIds.slice(0, FEED_SIZE)) {
      must(await ctx.db.get("milestones", id), "Milestone");
      await ctx.db.patch("milestones", id, { acknowledged: true, acknowledgedAt: Date.now() });
    }
    return null;
  },
});
