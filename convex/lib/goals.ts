/** Reads behind the season goals (`seasons/goals.ts`): a season's goals with what they are judged on. */
import { v } from "convex/values";
import { playerGoalFacts, teamGoalFacts } from "../../shared/seasons/goalFacts";
import { evaluateGoal, GOAL_STATUSES } from "../../shared/seasons/goals";
import { MAX_GOALS } from "../../shared/seasons/goalSpec";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { playersById } from "./franchise";
import { headshotUrls } from "./refs";
import { seasonGames } from "./reports";
import { literals, vPosition } from "./validators";

/** A player's season rows: one per team he played for, per split and source. */
const MAX_PLAYER_ROWS = 12;

export const vGoalRow = v.object({
  goal: schema.doc("seasonGoals"),
  player: v.union(
    v.null(),
    v.object({
      _id: v.id("players"),
      displayName: v.string(),
      position: vPosition,
      headshotUrl: v.union(v.string(), v.null()),
    }),
  ),
  evaluation: v.object({
    status: literals(GOAL_STATUSES),
    manual: v.boolean(),
    onTrack: v.boolean(),
    progress: v.union(
      v.null(),
      v.object({
        current: v.union(v.number(), v.null()),
        target: v.number(),
        better: literals(["higher", "lower"]),
      }),
    ),
  }),
});

export async function goalsOf(ctx: QueryCtx, seasonId: Id<"seasons">): Promise<Doc<"seasonGoals">[]> {
  return await ctx.db
    .query("seasonGoals")
    .withIndex("by_seasonId_and_order", (q) => q.eq("seasonId", seasonId))
    .take(MAX_GOALS);
}

/** Whether a player is on the user team's roster for the season. */
export async function onUserRoster(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
  seasonId: Id<"seasons">,
  playerId: Id<"players">,
) {
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
    .take(MAX_PLAYER_ROWS);
  return entries.some((e) => e.teamId === franchise.userTeamId);
}

/** Every goal of a season, in order, with its player and how it stands today. */
export async function evaluatedGoals(ctx: QueryCtx, franchise: Doc<"franchises">, season: Doc<"seasons">) {
  const goals = await goalsOf(ctx, season._id);
  if (goals.length === 0) return [];
  const [games, standing] = await Promise.all([
    seasonGames(ctx, season._id),
    ctx.db
      .query("standings")
      .withIndex("by_seasonId_and_teamId", (q) =>
        q.eq("seasonId", season._id).eq("teamId", franchise.userTeamId),
      )
      .unique(),
  ]);
  const team = teamGoalFacts(season, games, standing);
  const playerIds = [...new Set(goals.flatMap((g) => (g.playerId ? [g.playerId] : [])))];
  const [players, rows] = await Promise.all([
    playersById(ctx, playerIds),
    Promise.all(
      playerIds.map((playerId) =>
        ctx.db
          .query("seasonPlayerStats")
          .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", season._id))
          .take(MAX_PLAYER_ROWS),
      ),
    ),
  ]);
  const facts = new Map(playerIds.map((id, i) => [id, playerGoalFacts(rows[i] ?? [])]));
  const photos = await headshotUrls(ctx, players.values());
  return goals.map((goal) => {
    const p = goal.playerId ? players.get(goal.playerId) : undefined;
    return {
      goal,
      player: p
        ? {
            _id: p._id,
            displayName: p.displayName,
            position: p.position,
            headshotUrl: photos.get(p._id) ?? null,
          }
        : null,
      evaluation: evaluateGoal(goal, team, goal.playerId ? (facts.get(goal.playerId) ?? null) : null),
    };
  });
}
