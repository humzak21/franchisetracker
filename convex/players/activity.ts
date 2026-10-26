/** A player's moves and injuries for the player page (FEATURES.md 5.4, 5.10). */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { teamsById } from "../lib/franchise";
import { seasonYears, toTeamRef, vTeamRef } from "../lib/refs";
import { vTransactionDirection, vTransactionType, vWeekKey } from "../lib/validators";

const MAX_ROWS = 200;

export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.object({
    transactions: v.array(
      v.object({
        _id: v.id("transactions"),
        year: v.number(),
        weekKey: v.optional(vWeekKey),
        type: vTransactionType,
        direction: vTransactionDirection,
        team: v.union(vTeamRef, v.null()),
        counterpart: v.union(vTeamRef, v.null()),
        notes: v.optional(v.string()),
      }),
    ),
    injuries: v.array(
      v.object({
        _id: v.id("injuries"),
        year: v.number(),
        weekKey: v.optional(vWeekKey),
        injuryType: v.string(),
        lengthLabel: v.optional(v.string()),
        onIr: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const [links, injuries, teams] = await Promise.all([
      ctx.db
        .query("transactionPlayers")
        .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
        .take(MAX_ROWS),
      ctx.db
        .query("injuries")
        .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
        .take(MAX_ROWS),
      teamsById(ctx),
    ]);
    const txs = await Promise.all(
      links.map(async (l) => ({ link: l, tx: await ctx.db.get("transactions", l.transactionId) })),
    );
    const years = await seasonYears(ctx, [
      ...links.map((l) => l.seasonId),
      ...injuries.map((i) => i.seasonId),
    ]);
    const ref = (id: Parameters<typeof teams.get>[0] | undefined) => {
      const team = id ? teams.get(id) : undefined;
      return team ? toTeamRef(team) : null;
    };
    return {
      transactions: txs
        .flatMap(({ link, tx }) => {
          const year = years.get(link.seasonId);
          return tx && year !== undefined
            ? [
                {
                  _id: tx._id,
                  year,
                  weekKey: tx.weekKey,
                  type: tx.type,
                  direction: link.direction,
                  team: ref(tx.teamId),
                  counterpart: ref(tx.counterpartTeamId),
                  notes: tx.notes,
                },
              ]
            : [];
        })
        .sort((a, b) => b.year - a.year),
      injuries: injuries
        .flatMap((i) => {
          const year = years.get(i.seasonId);
          return year === undefined
            ? []
            : [
                {
                  _id: i._id,
                  year,
                  weekKey: i.weekKey,
                  injuryType: i.injuryType,
                  lengthLabel: i.lengthLabel,
                  onIr: i.onIr,
                },
              ];
        })
        .sort((a, b) => b.year - a.year),
    };
  },
});
