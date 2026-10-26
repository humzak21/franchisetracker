/** Compact references screens render (a team chip, a player chip) instead of whole documents. */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { headshotUrl } from "./media";

export const vTeamRef = v.object({
  _id: v.id("teams"),
  abbr: v.string(),
  city: v.string(),
  name: v.string(),
  primaryColor: v.string(),
  secondaryColor: v.string(),
});

export const toTeamRef = (team: Doc<"teams">) => ({
  _id: team._id,
  abbr: team.abbr,
  city: team.city,
  name: team.name,
  primaryColor: team.primaryColor,
  secondaryColor: team.secondaryColor,
});

/** Season years by id for a set of season ids; missing seasons are left out. */
export async function seasonYears(
  ctx: QueryCtx,
  ids: Iterable<Id<"seasons">>,
): Promise<Map<Id<"seasons">, number>> {
  const unique = [...new Set(ids)];
  const docs = await Promise.all(unique.map((id) => ctx.db.get("seasons", id)));
  return new Map(docs.filter((d): d is Doc<"seasons"> => d !== null).map((d) => [d._id, d.year]));
}

/** Headshot URLs keyed by player, for lists of players. */
export async function headshotUrls(
  ctx: QueryCtx,
  players: Iterable<Doc<"players">>,
): Promise<Map<Id<"players">, string | null>> {
  const list = [...players];
  const urls = await Promise.all(list.map((p) => headshotUrl(ctx, p)));
  return new Map(list.map((p, i) => [p._id, urls[i] ?? null]));
}
