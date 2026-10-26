/** Downloads ESPN images into Convex storage. Shared by the import, the player page and setup. */
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { espnHeadshotUrl, espnLogoUrl, fetchImage } from "./espn";

/** Parallel downloads per batch: quick without hammering the CDN. */
const CONCURRENCY = 6;

async function inBatches<T>(items: readonly T[], run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(run));
  }
}

/** Caches every team logo not cached yet. Returns how many were stored. */
export async function cacheTeamLogos(ctx: ActionCtx): Promise<number> {
  const missing = await ctx.runQuery(internal.league.logos.missing, {});
  let stored = 0;
  await inBatches(missing, async ({ teamId, abbr }) => {
    const image = await fetchImage(espnLogoUrl(abbr));
    if (!image) return;
    const storageId = await ctx.storage.store(image);
    await ctx.runMutation(internal.league.logos.save, { teamId, storageId });
    stored++;
  });
  return stored;
}

export async function cacheHeadshots(
  ctx: ActionCtx,
  players: readonly { playerId: Id<"players">; espnId: number }[],
): Promise<number> {
  let stored = 0;
  await inBatches(players, async ({ playerId, espnId }) => {
    const image = await fetchImage(espnHeadshotUrl(espnId));
    if (!image) return;
    const storageId = await ctx.storage.store(image);
    await ctx.runMutation(internal.players.headshots.save, { playerId, espnId, storageId });
    stored++;
  });
  return stored;
}
