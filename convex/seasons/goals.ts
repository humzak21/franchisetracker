/**
 * Pre-season goals (FEATURES.md 5.11): written on the season report, judged against the season's
 * record, playoff run and player totals, and shown on Home and Stats.
 */
import { v } from "convex/values";
import { goalSpecError, MAX_GOALS } from "../../shared/seasons/goalSpec";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { evaluatedGoals, goalsOf, onUserRoster, vGoalRow } from "../lib/goals";
import { ownSeason } from "../lib/reports";
import { vGoalOutcome, vGoalScope, vGoalType, vSeasonStatus } from "../lib/validators";

const vSpec = v.object({
  scope: vGoalScope,
  type: vGoalType,
  playerId: v.optional(v.id("players")),
  statKey: v.optional(v.string()),
  target: v.optional(v.number()),
  text: v.optional(v.string()),
});
const specArgs = vSpec.fields;
type Spec = typeof vSpec.type;

/**
 * A season's goals with their status, or null for a season that is not the active franchise's
 * own (real NFL history before it, or another franchise's), which Home and Stats can select.
 */
export const list = query({
  args: { seasonId: v.id("seasons") },
  returns: v.union(v.null(), v.object({ year: v.number(), status: vSeasonStatus, goals: v.array(vGoalRow) })),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id || season.year < franchise.startYear) return null;
    return { year: season.year, status: season.status, goals: await evaluatedGoals(ctx, franchise, season) };
  },
});

/** Checks a goal against the rules and the season's roster; returns the fields to store. */
async function checkedSpec(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  seasonId: Id<"seasons">,
  spec: Spec,
) {
  const text = spec.text?.trim() || undefined;
  const error = goalSpecError({ ...spec, text, hasPlayer: spec.playerId !== undefined });
  if (error) throw invalid(error);
  if (spec.playerId && !(await onUserRoster(ctx, franchise, seasonId, spec.playerId))) {
    throw invalid("Pick a player on this season's roster");
  }
  return { ...spec, text };
}

async function ownGoal(ctx: MutationCtx, goalId: Id<"seasonGoals">) {
  const goal = must(await ctx.db.get("seasonGoals", goalId), "Goal");
  const { franchise, season } = await ownSeason(ctx, goal.seasonId);
  return { goal, franchise, season };
}

export const add = mutation({
  args: { seasonId: v.id("seasons"), ...specArgs },
  returns: v.id("seasonGoals"),
  handler: async (ctx, { seasonId, ...spec }) => {
    await requireOwner(ctx);
    const { franchise } = await ownSeason(ctx, seasonId);
    const fields = await checkedSpec(ctx, franchise, seasonId, spec);
    const goals = await goalsOf(ctx, seasonId);
    if (goals.length >= MAX_GOALS) throw invalid(`A season holds at most ${MAX_GOALS} goals`);
    const order = (goals.at(-1)?.order ?? -1) + 1;
    return await ctx.db.insert("seasonGoals", { franchiseId: franchise._id, seasonId, ...fields, order });
  },
});

/** Rewrites a goal. A manual outcome stays unless the kind of goal changed. */
export const update = mutation({
  args: { goalId: v.id("seasonGoals"), ...specArgs },
  returns: v.null(),
  handler: async (ctx, { goalId, ...spec }) => {
    await requireOwner(ctx);
    const { goal, franchise } = await ownGoal(ctx, goalId);
    const fields = await checkedSpec(ctx, franchise, goal.seasonId, spec);
    const outcome = goal.type === fields.type && goal.scope === fields.scope ? goal.outcome : undefined;
    await ctx.db.replace("seasonGoals", goalId, {
      franchiseId: goal.franchiseId,
      seasonId: goal.seasonId,
      order: goal.order,
      ...fields,
      outcome,
    });
    return null;
  },
});

/** Marks a goal hit or missed by hand, or (null) hands it back to the numbers. */
export const setOutcome = mutation({
  args: { goalId: v.id("seasonGoals"), outcome: v.union(vGoalOutcome, v.null()) },
  returns: v.null(),
  handler: async (ctx, { goalId, outcome }) => {
    await requireOwner(ctx);
    await ownGoal(ctx, goalId);
    await ctx.db.patch("seasonGoals", goalId, { outcome: outcome ?? undefined });
    return null;
  },
});

export const remove = mutation({
  args: { goalId: v.id("seasonGoals") },
  returns: v.null(),
  handler: async (ctx, { goalId }) => {
    await requireOwner(ctx);
    await ownGoal(ctx, goalId);
    await ctx.db.delete("seasonGoals", goalId);
    return null;
  },
});

/** Swaps a goal with its neighbour above (-1) or below (1); at either end nothing moves. */
export const move = mutation({
  args: { goalId: v.id("seasonGoals"), direction: v.union(v.literal(-1), v.literal(1)) },
  returns: v.null(),
  handler: async (ctx, { goalId, direction }) => {
    await requireOwner(ctx);
    const { goal } = await ownGoal(ctx, goalId);
    const neighbour = await ctx.db
      .query("seasonGoals")
      .withIndex("by_seasonId_and_order", (q) =>
        direction === 1
          ? q.eq("seasonId", goal.seasonId).gt("order", goal.order)
          : q.eq("seasonId", goal.seasonId).lt("order", goal.order),
      )
      .order(direction === 1 ? "asc" : "desc")
      .first();
    if (!neighbour) return null;
    await ctx.db.patch("seasonGoals", goalId, { order: neighbour.order });
    await ctx.db.patch("seasonGoals", neighbour._id, { order: goal.order });
    return null;
  },
});
