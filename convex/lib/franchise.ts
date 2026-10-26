/** Read helpers shared by the screen queries. */
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { must } from "./errors";

/** 32 teams today; headroom without becoming unbounded. */
const MAX_TEAMS = 64;

export async function activeFranchise(ctx: QueryCtx): Promise<Doc<"franchises">> {
  const franchise = await ctx.db
    .query("franchises")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .first();
  return must(franchise, "Active franchise");
}

/** Every team keyed by id. One bounded read; screens resolve team references from it. */
export async function teamsById(ctx: QueryCtx): Promise<Map<Id<"teams">, Doc<"teams">>> {
  const teams = await ctx.db.query("teams").take(MAX_TEAMS);
  return new Map(teams.map((team) => [team._id, team]));
}

/** Resolves player ids to documents, skipping any that no longer exist. */
export async function playersById(
  ctx: QueryCtx,
  ids: Iterable<Id<"players">>,
): Promise<Map<Id<"players">, Doc<"players">>> {
  const unique = [...new Set(ids)];
  const docs = await Promise.all(unique.map((id) => ctx.db.get("players", id)));
  return new Map(docs.filter((doc): doc is Doc<"players"> => doc !== null).map((doc) => [doc._id, doc]));
}
