/**
 * Created coaches (FEATURES.md 5.8): Coach of the Year picks from the bank of real head coaches
 * since 2015 (`shared/domain/coaches.ts`) plus the coaches made here, like create-a-player.
 */
import { v } from "convex/values";
import { coachKey, findBankCoach } from "../../shared/domain/coaches";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { cleanCoachName, createdCoach } from "../lib/coaches";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";

/** A franchise makes a handful; headroom without becoming unbounded. */
const MAX_COACHES = 500;

export const list = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("coaches"), name: v.string(), team: v.union(vTeamRef, v.null()) })),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const coaches = await ctx.db
      .query("coaches")
      .withIndex("by_franchiseId_and_key", (q) => q.eq("franchiseId", franchise._id))
      .take(MAX_COACHES);
    return await Promise.all(
      coaches.map(async (c) => {
        const team = c.teamId ? await ctx.db.get("teams", c.teamId) : null;
        return { _id: c._id, name: c.name, team: team ? toTeamRef(team) : null };
      }),
    );
  },
});

export const create = mutation({
  args: { name: v.string(), teamId: v.optional(v.id("teams")) },
  returns: v.object({ _id: v.id("coaches"), name: v.string() }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const name = cleanCoachName(args.name);
    const bank = findBankCoach(name);
    if (bank) throw invalid(`${bank.name} is already in the coach list`);
    if (await createdCoach(ctx, franchise._id, name)) throw invalid(`${name} has already been created`);
    if (args.teamId) must(await ctx.db.get("teams", args.teamId), "Team");
    const _id = await ctx.db.insert("coaches", {
      franchiseId: franchise._id,
      name,
      key: coachKey(name),
      teamId: args.teamId,
    });
    return { _id, name };
  },
});

/** Deletes a created coach; awards already won keep the name. */
export const remove = mutation({
  args: { coachId: v.id("coaches") },
  returns: v.null(),
  handler: async (ctx, { coachId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const coach = must(await ctx.db.get("coaches", coachId), "Coach");
    if (coach.franchiseId !== franchise._id) throw invalid("That coach belongs to another franchise");
    await ctx.db.delete("coaches", coachId);
    return null;
  },
});
