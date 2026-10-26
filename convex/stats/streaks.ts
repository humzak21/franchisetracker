import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById } from "../lib/franchise";
import { vPosition } from "../lib/validators";

const MAX_STREAKS = 500;

const vStreak = v.object({ key: v.string(), current: v.number(), longest: v.number() });

/** Team streaks plus every player's, longest current runs first. */
export const all = query({
  args: {},
  returns: v.object({
    team: v.array(vStreak),
    players: v.array(
      v.object({
        ...vStreak.fields,
        player: v.object({ _id: v.id("players"), name: v.string(), position: vPosition }),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const rows = await ctx.db
      .query("streaks")
      .withIndex("by_franchiseId_and_playerId", (q) => q.eq("franchiseId", franchise._id))
      .take(MAX_STREAKS);
    const players = await playersById(
      ctx,
      rows.flatMap((r) => (r.playerId ? [r.playerId] : [])),
    );
    const strip = ({ key, current, longest }: (typeof rows)[number]) => ({ key, current, longest });
    return {
      team: rows.filter((r) => !r.playerId).map(strip),
      players: rows
        .flatMap((r) => {
          const p = r.playerId ? players.get(r.playerId) : undefined;
          return p
            ? [{ ...strip(r), player: { _id: p._id, name: p.displayName, position: p.position } }]
            : [];
        })
        .sort((a, b) => b.current - a.current || b.longest - a.longest),
    };
  },
});

export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.array(vStreak),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const rows = await ctx.db
      .query("streaks")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(20);
    return rows.map(({ key, current, longest }) => ({ key, current, longest }));
  },
});
