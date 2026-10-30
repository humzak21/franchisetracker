/**
 * A committed roster page is the truth for its team and season (FEATURES.md 5.3). Anyone the page
 * lists is on the team and nowhere else; on a whole page, anyone it leaves off is released as of
 * its week. What that changed is kept as an undo list until the owner settles it.
 */
import { v } from "convex/values";
import { onRoster } from "../../shared/roster/averages";
import { isWholeRoster, offThePage } from "../../shared/roster/rosterPage";
import type { WeekKey } from "../../shared/domain";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, MAX_ROSTER, playersById } from "../lib/franchise";
import { vPosition, vRosterStatus, vWeekKey } from "../lib/validators";

/** One player's entries in one season: a few teams at most, even after moves. */
const MAX_STINTS = 20;

type Change = Doc<"rosterSyncs">["changes"][number];

const teamSeasonEntries = (ctx: QueryCtx, seasonId: Id<"seasons">, teamId: Id<"teams">) =>
  ctx.db
    .query("rosterEntries")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
    .take(MAX_ROSTER);

/** Writes what a committed page means for the team's entries and records it for undoing. */
export async function syncRosterPage(
  ctx: MutationCtx,
  args: {
    franchiseId: Id<"franchises">;
    seasonId: Id<"seasons">;
    teamId: Id<"teams">;
    weekKey: WeekKey | undefined;
    rows: number;
    partial: boolean;
    onPage: ReadonlySet<Id<"players">>;
  },
) {
  const { seasonId, teamId, weekKey, onPage } = args;
  const changes: Change[] = [];
  const change = async (entry: Doc<"rosterEntries">, to: Doc<"rosterEntries">["status"]) => {
    changes.push({ entryId: entry._id, from: entry.status, fromWeekKey: entry.statusWeekKey, to });
    await ctx.db.patch("rosterEntries", entry._id, { status: to, statusWeekKey: weekKey });
  };
  const entries = await teamSeasonEntries(ctx, seasonId, teamId);
  for (const entry of entries) {
    if (onPage.has(entry.playerId) && !onRoster(entry.status)) await change(entry, "active");
  }
  for (const playerId of onPage) {
    const stints = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
      .take(MAX_STINTS);
    for (const stint of stints) {
      if (stint.teamId !== teamId && onRoster(stint.status)) await change(stint, "traded");
    }
  }
  const whole = isWholeRoster(args.rows, args.partial);
  if (whole) {
    for (const entry of offThePage(entries, onPage)) await change(entry, "released");
  }
  await ctx.db.insert("rosterSyncs", {
    franchiseId: args.franchiseId,
    seasonId,
    teamId,
    weekKey,
    rows: args.rows,
    whole,
    changes,
    committedAt: Date.now(),
  });
}

export const latestSync = (ctx: QueryCtx, seasonId: Id<"seasons">, teamId: Id<"teams">) =>
  ctx.db
    .query("rosterSyncs")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
    .order("desc")
    .first();

const vLeaver = v.object({
  playerId: v.id("players"),
  displayName: v.string(),
  position: vPosition,
  ovr: v.optional(v.number()),
});

/** Before commit: who this page would take off the team, for review to show. */
export const preview = query({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    /** The accepted rows' players; a row with a new name has none. */
    playerIds: v.array(v.id("players")),
    rows: v.number(),
    partial: v.boolean(),
  },
  returns: v.object({ whole: v.boolean(), leaving: v.array(vLeaver) }),
  handler: async (ctx, { seasonId, teamId, playerIds, rows, partial }) => {
    await requireOwner(ctx);
    const whole = isWholeRoster(rows, partial);
    if (!whole) return { whole, leaving: [] };
    const entries = await teamSeasonEntries(ctx, seasonId, teamId);
    const off = offThePage(entries, new Set(playerIds));
    const players = await playersById(
      ctx,
      off.map((e) => e.playerId),
    );
    const leaving = off.flatMap((e) => {
      const player = players.get(e.playerId);
      return player
        ? [{ playerId: player._id, displayName: player.displayName, position: e.position, ovr: e.ovr }]
        : [];
    });
    return { whole, leaving };
  },
});

/** The team's latest roster page, with the changes still waiting on the owner. */
export const latest = query({
  args: { seasonId: v.id("seasons"), teamId: v.id("teams") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("rosterSyncs"),
      rows: v.number(),
      whole: v.boolean(),
      weekKey: v.optional(vWeekKey),
      committedAt: v.number(),
      changes: v.array(
        v.object({
          entryId: v.id("rosterEntries"),
          playerId: v.id("players"),
          displayName: v.string(),
          position: vPosition,
          from: vRosterStatus,
          to: vRosterStatus,
        }),
      ),
    }),
  ),
  handler: async (ctx, { seasonId, teamId }) => {
    await requireOwner(ctx);
    const sync = await latestSync(ctx, seasonId, teamId);
    if (!sync) return null;
    const entries = await Promise.all(sync.changes.map((c) => ctx.db.get("rosterEntries", c.entryId)));
    const players = await playersById(
      ctx,
      entries.flatMap((e) => (e ? [e.playerId] : [])),
    );
    return {
      _id: sync._id,
      rows: sync.rows,
      whole: sync.whole,
      weekKey: sync.weekKey,
      committedAt: sync.committedAt,
      changes: sync.changes.flatMap((c, i) => {
        const entry = entries[i];
        const player = entry && players.get(entry.playerId);
        return entry && player
          ? [
              {
                entryId: c.entryId,
                playerId: player._id,
                displayName: player.displayName,
                position: entry.position,
                from: c.from,
                to: c.to,
              },
            ]
          : [];
      }),
    };
  },
});

/**
 * Settles a page's undo list: the named changes are put back, leaving any entry that has moved on
 * since, and the rest stand. With nothing named, it just clears the list.
 */
export const settle = mutation({
  args: { syncId: v.id("rosterSyncs"), undo: v.array(v.id("rosterEntries")) },
  returns: v.null(),
  handler: async (ctx, { syncId, undo }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const sync = must(await ctx.db.get("rosterSyncs", syncId), "Roster page");
    if (sync.franchiseId !== franchise._id) throw invalid("That roster page is in another franchise");
    const named = new Set(undo);
    for (const change of sync.changes) {
      if (!named.has(change.entryId)) continue;
      const entry = await ctx.db.get("rosterEntries", change.entryId);
      if (entry?.status !== change.to) continue;
      await ctx.db.patch("rosterEntries", entry._id, {
        status: change.from,
        statusWeekKey: change.fromWeekKey,
      });
    }
    await ctx.db.patch("rosterSyncs", syncId, { changes: [] });
    return null;
  },
});
