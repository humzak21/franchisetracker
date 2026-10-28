/**
 * Awards counted from the numbers (FEATURES.md 5.8): the league leaders in fantasy points,
 * sacks, interceptions and tackles from league stats, and the most players of the week from the
 * weekly awards. Counted live; a winner assigned on the awards screen overrides the count.
 */
import { v } from "convex/values";
import { COUNTED_AWARDS, countedContenders } from "../../shared/awards/counted";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { leagueSeasonLines } from "../lib/leagueStats";
import { headshotUrls, toTeamRef, vTeamRef } from "../lib/refs";
import { vAwardType } from "../lib/validators";
import { vAwardPlayer } from "./awards";

/** Every week's players of the week for both conferences, with headroom. */
const MAX_WEEKLY = 200;

export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      type: vAwardType,
      contenders: v.array(
        v.object({
          name: v.string(),
          player: vAwardPlayer,
          team: v.union(vTeamRef, v.null()),
          isUser: v.boolean(),
          value: v.number(),
          statLine: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const weekly = (type: "OPOW" | "DPOW") =>
      ctx.db
        .query("awards")
        .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", seasonId).eq("type", type))
        .take(MAX_WEEKLY);
    const [lines, opow, dpow] = await Promise.all([
      leagueSeasonLines(ctx, franchise, seasonId),
      weekly("OPOW"),
      weekly("DPOW"),
    ]);
    const winners = [...opow, ...dpow];
    const named = await playersById(
      ctx,
      winners.flatMap((w) => (w.playerId ? [w.playerId] : [])),
    );
    const counted = countedContenders(
      lines.map((l) => ({ playerId: l.playerId, teamId: l.teamId, line: l.totals, games: l.gamesPlayed })),
      winners.map((w) => ({
        type: w.type,
        playerId: w.playerId ?? null,
        name: (w.playerId && named.get(w.playerId)?.displayName) || w.rawName || "Unknown",
        teamId: w.teamId ?? null,
      })),
    );
    const ids = COUNTED_AWARDS.flatMap((type) =>
      counted[type].flatMap((c) => (c.playerId ? [c.playerId] : [])),
    );
    const [players, teams] = await Promise.all([playersById(ctx, ids), teamsById(ctx)]);
    const photos = await headshotUrls(ctx, players.values());
    return COUNTED_AWARDS.map((type) => ({
      type,
      contenders: counted[type].map((c) => {
        const p = c.playerId ? players.get(c.playerId) : undefined;
        const team = c.teamId ? teams.get(c.teamId) : undefined;
        return {
          name: p?.displayName ?? c.name ?? "Unknown",
          player: p
            ? {
                _id: p._id,
                displayName: p.displayName,
                position: p.position,
                headshotUrl: photos.get(p._id) ?? null,
              }
            : null,
          team: team ? toTeamRef(team) : null,
          isUser: team?._id === franchise.userTeamId,
          value: c.value,
          statLine: c.statLine,
        };
      }),
    }));
  },
});
