/** Finding players by what they are called: the display name, then the names screens print. */
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Name matches first, then alias matches, up to `limit`. Two indexes rather than one combined
 * field, so the imported history needs no rewrite: only players with aliases carry `aliasesText`.
 */
export async function searchPlayers(
  ctx: QueryCtx,
  franchiseId: Id<"franchises">,
  text: string,
  limit: number,
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<Doc<"players">[]> {
  const named = await ctx.db
    .query("players")
    .withSearchIndex("search_displayName", (q) => {
      const query = q.search("displayName", text).eq("franchiseId", franchiseId);
      return activeOnly ? query.eq("retired", false) : query;
    })
    .take(limit);
  const aliased = await ctx.db
    .query("players")
    .withSearchIndex("search_aliases", (q) => {
      const query = q.search("aliasesText", text).eq("franchiseId", franchiseId);
      return activeOnly ? query.eq("retired", false) : query;
    })
    .take(limit);
  const byId = new Map([...named, ...aliased].map((p) => [p._id, p]));
  return [...byId.values()].slice(0, limit);
}
