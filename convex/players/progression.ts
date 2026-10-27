/**
 * OVR progression (FEATURES.md 5.4): the rating on each season's roster entry plus in-season
 * snapshots. Entry ratings are edited through `roster:updateEntry`; snapshots here.
 */
import { v } from "convex/values";
import { weekIndex } from "../../shared/domain";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { seasonYears } from "../lib/refs";
import { vWeekKey } from "../lib/validators";

const MAX_ROWS = 200;

function checkOvr(ovr: number) {
  if (!Number.isInteger(ovr) || ovr < 0 || ovr > 99) throw invalid("OVR must be a whole number from 0 to 99");
}

/** Points oldest first: each season's entry rating (`weekKey: null`), then that season's snapshots by week. */
export const ovr = query({
  args: { playerId: v.id("players") },
  returns: v.array(
    v.object({
      year: v.number(),
      seasonId: v.id("seasons"),
      weekKey: v.union(vWeekKey, v.null()),
      ovr: v.number(),
      snapshotId: v.union(v.id("playerSnapshots"), v.null()),
    }),
  ),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const [entries, snapshots] = await Promise.all([
      ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
        .take(MAX_ROWS),
      ctx.db
        .query("playerSnapshots")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
        .take(MAX_ROWS),
    ]);
    const years = await seasonYears(
      ctx,
      [...entries, ...snapshots].map((r) => r.seasonId),
    );
    const points = [
      ...entries.flatMap((e) =>
        e.ovr === undefined ? [] : [{ seasonId: e.seasonId, weekKey: null, ovr: e.ovr, snapshotId: null }],
      ),
      ...snapshots.map((s) => ({ seasonId: s.seasonId, weekKey: s.weekKey, ovr: s.ovr, snapshotId: s._id })),
    ].flatMap((p) => {
      const year = years.get(p.seasonId);
      return year === undefined ? [] : [{ ...p, year }];
    });
    const order = (p: (typeof points)[number]) => (p.weekKey === null ? -1 : weekIndex(p.weekKey));
    return points.sort((a, b) => a.year - b.year || order(a) - order(b));
  },
});

/** Records an in-season OVR checkpoint; one per player per week, so re-saving a week replaces it. */
export const saveSnapshot = mutation({
  args: { playerId: v.id("players"), seasonId: v.id("seasons"), weekKey: vWeekKey, ovr: v.number() },
  returns: v.null(),
  handler: async (ctx, { playerId, seasonId, weekKey, ovr }) => {
    await requireOwner(ctx);
    checkOvr(ovr);
    const player = must(await ctx.db.get("players", playerId), "Player");
    must(await ctx.db.get("seasons", seasonId), "Season");
    const existing = await ctx.db
      .query("playerSnapshots")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
      .take(MAX_ROWS);
    const same = existing.find((s) => s.weekKey === weekKey);
    if (same) await ctx.db.patch("playerSnapshots", same._id, { ovr });
    else
      await ctx.db.insert("playerSnapshots", {
        franchiseId: player.franchiseId,
        seasonId,
        playerId,
        weekKey,
        ovr,
      });
    return null;
  },
});

export const removeSnapshot = mutation({
  args: { snapshotId: v.id("playerSnapshots") },
  returns: v.null(),
  handler: async (ctx, { snapshotId }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("playerSnapshots", snapshotId), "Snapshot");
    await ctx.db.delete("playerSnapshots", snapshotId);
    return null;
  },
});
