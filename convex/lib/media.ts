/** Image URLs for screens: cached copies in Convex storage first, ESPN's CDN as the fallback. */
import { espnHeadshotUrl } from "../external/espn";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type HeadshotSource = Pick<Doc<"players">, "headshotStorageId" | "espnId" | "isReal">;

/** A real player's photo: the cached copy, else ESPN's. Fictional players get null (a monogram card). */
export async function headshotUrl(ctx: QueryCtx, player: HeadshotSource): Promise<string | null> {
  if (player.headshotStorageId) return await ctx.storage.getUrl(player.headshotStorageId);
  return player.isReal && player.espnId !== undefined ? espnHeadshotUrl(player.espnId) : null;
}
