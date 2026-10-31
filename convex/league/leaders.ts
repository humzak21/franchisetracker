/** Madden's league leaders as captured (FEATURES.md 5.5), and where the user's team stands on them. */
import { v } from "convex/values";
import { whereWeRank } from "../../shared/stats";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";

/** A top twenty for every stat a leaders screen can show, with headroom. */
const MAX_LEADERS = 3000;

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());

const vLeader = v.object({
  statKey: v.string(),
  rank: v.number(),
  tied: v.boolean(),
  playerId: nullable(v.id("players")),
  name: v.string(),
  team: nullable(vTeamRef),
  teamId: nullable(v.id("teams")),
  value: v.number(),
  ours: v.boolean(),
});

export const forSeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    rows: v.array(vLeader),
    summary: v.object({
      spots: v.number(),
      topFive: v.number(),
      leaders: v.number(),
      best: v.array(vLeader),
    }),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    must(await ctx.db.get("seasons", seasonId), "Season");
    const leaders = await ctx.db
      .query("leagueLeaders")
      .withIndex("by_seasonId_and_statKey_and_rank", (q) => q.eq("seasonId", seasonId))
      .take(MAX_LEADERS);
    const [players, teams] = await Promise.all([
      playersById(
        ctx,
        leaders.flatMap((l) => (l.playerId ? [l.playerId] : [])),
      ),
      teamsById(ctx),
    ]);
    const rows = leaders.map((l) => {
      const player = l.playerId ? players.get(l.playerId) : undefined;
      const team = l.teamId ? teams.get(l.teamId) : undefined;
      return {
        statKey: l.statKey,
        rank: l.rank,
        tied: l.tied ?? false,
        playerId: (player?._id ?? null) as Id<"players"> | null,
        name: player?.displayName ?? l.rawName ?? "Unknown",
        team: team ? toTeamRef(team) : null,
        teamId: l.teamId ?? null,
        value: l.value,
        ours: l.teamId === franchise.userTeamId,
      };
    });
    return { rows, summary: whereWeRank(rows, franchise.userTeamId) };
  },
});
