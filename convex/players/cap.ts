/** The cap view (FEATURES.md 5.3, 5.10): the user team's contracts for a season against its cap. */
import { v } from "convex/values";
import { capSummary } from "../../shared/roster/cap";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { ownSeason } from "../lib/reports";
import { vPosition } from "../lib/validators";

const MAX_ROSTER = 150;

export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    year: v.number(),
    salaryCap: v.union(v.number(), v.null()),
    committed: v.number(),
    space: v.union(v.number(), v.null()),
    rostered: v.number(),
    players: v.array(
      v.object({
        playerId: v.id("players"),
        displayName: v.string(),
        position: vPosition,
        jersey: v.optional(v.number()),
        ovr: v.optional(v.number()),
        headshotUrl: v.union(v.string(), v.null()),
        apy: v.union(v.number(), v.null()),
        years: v.optional(v.number()),
        expiresYear: v.optional(v.number()),
        expiring: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const { franchise, season } = await ownSeason(ctx, seasonId);
    const entries = (
      await ctx.db
        .query("rosterEntries")
        .withIndex("by_seasonId_and_teamId", (q) =>
          q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
        )
        .take(MAX_ROSTER)
    ).filter((e) => e.status !== "released");
    const players = await playersById(
      ctx,
      entries.map((e) => e.playerId),
    );
    const photos = await headshotUrls(ctx, players.values());
    const summary = capSummary(
      entries.map((e) => ({ playerId: e.playerId, contract: e.contract })),
      season.salaryCap,
      season.year,
    );
    const hits = new Map(summary.hits.map((h) => [h.playerId, h.apy]));
    const expiring = new Set(summary.expiring);
    const rows = entries.flatMap((e) => {
      const p = players.get(e.playerId);
      return p
        ? [
            {
              playerId: p._id,
              displayName: p.displayName,
              position: e.position,
              jersey: e.jersey,
              ovr: e.ovr,
              headshotUrl: photos.get(p._id) ?? null,
              apy: hits.get(p._id) ?? null,
              years: e.contract?.years,
              expiresYear: e.contract?.expiresYear,
              expiring: expiring.has(p._id),
            },
          ]
        : [];
    });
    rows.sort((a, b) => (b.apy ?? -1) - (a.apy ?? -1) || a.displayName.localeCompare(b.displayName));
    return {
      year: season.year,
      salaryCap: season.salaryCap ?? null,
      committed: summary.committed,
      space: summary.space,
      rostered: entries.length,
      players: rows,
    };
  },
});

/** The season's salary cap in dollars; cleared with null. */
export const setSalaryCap = mutation({
  args: { seasonId: v.id("seasons"), salaryCap: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { seasonId, salaryCap }) => {
    await requireOwner(ctx);
    await ownSeason(ctx, seasonId);
    if (
      salaryCap !== null &&
      (!Number.isFinite(salaryCap) || salaryCap < 1_000_000 || salaryCap > 2_000_000_000)
    ) {
      throw invalid("Enter the cap in dollars, between $1M and $2B");
    }
    await ctx.db.patch("seasons", seasonId, { salaryCap: salaryCap ?? undefined });
    return null;
  },
});
