/** Created coaches (Coach of the Year) beside the bank of real head coaches. */
import { coachKey, findBankCoach } from "../../shared/domain/coaches";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { invalid } from "./errors";

export const MAX_COACH_NAME = 60;

export function cleanCoachName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > MAX_COACH_NAME) {
    throw invalid(`Name the coach (up to ${MAX_COACH_NAME} characters)`);
  }
  return clean;
}

export async function createdCoach(
  ctx: QueryCtx,
  franchiseId: Id<"franchises">,
  name: string,
): Promise<Doc<"coaches"> | null> {
  return await ctx.db
    .query("coaches")
    .withIndex("by_franchiseId_and_key", (q) => q.eq("franchiseId", franchiseId).eq("key", coachKey(name)))
    .first();
}

/**
 * The coach's name as the bank or the franchise spells it; a coach neither knows is created,
 * the way an unknown player on a screenshot becomes a new player.
 */
export async function ensureCoach(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  printed: string,
  teamId?: Id<"teams">,
): Promise<string> {
  const name = cleanCoachName(printed);
  const known = findBankCoach(name)?.name ?? (await createdCoach(ctx, franchiseId, name))?.name;
  if (known) return known;
  await ctx.db.insert("coaches", { franchiseId, name, key: coachKey(name), teamId });
  return name;
}
