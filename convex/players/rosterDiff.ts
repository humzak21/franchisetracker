/** A team's roster between two seasons (FEATURES.md 5.3): arrivals, departures and OVR changes. */
import { v } from "convex/values";
import { rosterDiff } from "../../shared/roster/diff";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { MAX_ROSTER, playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { ownSeason } from "../lib/reports";
import { vPosition, vRosterStatus } from "../lib/validators";

const vRow = v.object({
  playerId: v.id("players"),
  displayName: v.string(),
  position: vPosition,
  status: vRosterStatus,
  ovr: v.optional(v.number()),
  headshotUrl: v.union(v.string(), v.null()),
});

const entriesOf = (ctx: QueryCtx, seasonId: Id<"seasons">, teamId: Id<"teams">) =>
  ctx.db
    .query("rosterEntries")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
    .take(MAX_ROSTER);

export const between = query({
  args: { teamId: v.id("teams"), fromSeasonId: v.id("seasons"), toSeasonId: v.id("seasons") },
  returns: v.object({
    arrivals: v.array(vRow),
    departures: v.array(vRow),
    changes: v.array(v.object({ before: vRow, after: vRow, delta: v.number() })),
  }),
  handler: async (ctx, { teamId, fromSeasonId, toSeasonId }) => {
    await requireOwner(ctx);
    await Promise.all([ownSeason(ctx, fromSeasonId), ownSeason(ctx, toSeasonId)]);
    const [before, after] = await Promise.all([
      entriesOf(ctx, fromSeasonId, teamId),
      entriesOf(ctx, toSeasonId, teamId),
    ]);
    const players = await playersById(
      ctx,
      [...before, ...after].map((e) => e.playerId),
    );
    const photos = await headshotUrls(ctx, players.values());
    const rows = (entries: Doc<"rosterEntries">[]) =>
      entries.flatMap((e) => {
        const player = players.get(e.playerId);
        return player
          ? [
              {
                playerId: e.playerId,
                displayName: player.displayName,
                position: e.position,
                status: e.status,
                ovr: e.ovr,
                headshotUrl: photos.get(e.playerId) ?? null,
              },
            ]
          : [];
      });
    return rosterDiff(rows(before), rows(after));
  },
});
