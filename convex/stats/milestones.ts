/** The milestone feed on the dashboard (FEATURES.md 5.1): detected events, acknowledged with one tap. */
import { v } from "convex/values";
import { distinctMarks, playerTimeline, type MarkStat } from "../../shared/stats";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vMilestoneKind, vWeekKey } from "../lib/validators";
import { fastestList, seasonYears } from "./marks";

const FEED_SIZE = 30;
/** Everything a long career raises, threshold games included. */
const MAX_PLAYER_MILESTONES = 400;
/** Every mark a player can hold; `playerMarks` keeps one row per stat, mark, horizon and season. */
const MAX_PLAYER_MARKS = 600;

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

/** A player's milestones and the marks he reached, newest first, for his page. */
export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.array(
    v.object({
      key: v.string(),
      kind: vMilestoneKind,
      title: v.string(),
      detail: v.union(v.string(), v.null()),
      year: v.number(),
      weekKey: v.union(vWeekKey, v.null()),
      gameId: v.union(v.id("games"), v.null()),
    }),
  ),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    const [years, milestones, marks] = await Promise.all([
      seasonYears(ctx, franchise._id),
      ctx.db
        .query("milestones")
        .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
        .take(MAX_PLAYER_MILESTONES),
      ctx.db
        .query("playerMarks")
        .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
        .take(MAX_PLAYER_MARKS),
    ]);
    const shown = distinctMarks(marks.map((m) => ({ ...m, statKey: m.statKey as MarkStat })));
    const ranked = await Promise.all(
      shown.map(async (m) => {
        const list = await fastestList(ctx, franchise._id, years, m.statKey, m.mark, m.horizon);
        const mine = list.find((e) => e.playerId === playerId && e.seasonId === m.seasonId);
        return { ...m, year: years.get(m.seasonId) ?? 0, rank: mine?.rank ?? null };
      }),
    );
    return playerTimeline<Id<"games">>(
      player.displayName,
      milestones.map((m) => ({
        key: m._id,
        kind: m.kind,
        title: m.title,
        year: years.get(m.seasonId) ?? 0,
        weekKey: m.weekKey ?? null,
        gameId: m.gameId ?? null,
      })),
      ranked,
    );
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
