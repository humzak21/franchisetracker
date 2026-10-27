/**
 * Picks changing hands in a recorded trade (`draftPickInventory`, FEATURES.md 5.9). Rows exist
 * only for picks that moved: a team's own pick gets a row the first time it is traded, and the
 * row's owner follows each later trade. Undo puts each pick back while it is still where the
 * trade sent it.
 */
import type { PickMove } from "../../shared/transactions";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { MoveEffects } from "./rosterEffects";

type PickEffect = MoveEffects["picks"][number];

/** One team's picks in one draft year, traded or acquired: a handful at most. */
const MAX_YEAR_ROWS = 50;

const unused = (rows: Doc<"draftPickInventory">[], round: number) =>
  rows.filter((r) => r.round === round && r.draftPickId === undefined);

async function rowsByOrigin(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  origin: Id<"teams">,
  year: number,
) {
  return await ctx.db
    .query("draftPickInventory")
    .withIndex("by_franchiseId_and_originTeamId_and_year", (q) =>
      q.eq("franchiseId", franchiseId).eq("originTeamId", origin).eq("year", year),
    )
    .take(MAX_YEAR_ROWS);
}

/**
 * Whose pick a sender is giving up when the owner did not say: its own, unless it already traded
 * its own away and holds one it acquired in that round.
 */
export async function resolvePickOrigin(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  pick: { year: number; round: number; originTeamId?: Id<"teams"> },
  senderId: Id<"teams">,
): Promise<Id<"teams">> {
  if (pick.originTeamId) return pick.originTeamId;
  const own = unused(await rowsByOrigin(ctx, franchiseId, senderId, pick.year), pick.round);
  if (!own.some((r) => r.ownerTeamId !== senderId)) return senderId;
  const held = await ctx.db
    .query("draftPickInventory")
    .withIndex("by_franchiseId_and_ownerTeamId_and_year", (q) =>
      q.eq("franchiseId", franchiseId).eq("ownerTeamId", senderId).eq("year", pick.year),
    )
    .take(MAX_YEAR_ROWS);
  const acquired = unused(held, pick.round).find((r) => r.originTeamId !== senderId);
  return acquired?.originTeamId ?? senderId;
}

/** Moves each pick to its new owner; picks must already carry their origin. */
export async function applyPicks(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  transactionId: Id<"transactions">,
  picks: readonly (PickMove<Id<"teams">> & { originTeamId: Id<"teams"> })[],
): Promise<PickEffect[]> {
  const effects: PickEffect[] = [];
  for (const pick of picks) {
    const [row] = unused(await rowsByOrigin(ctx, franchiseId, pick.originTeamId, pick.year), pick.round);
    const moved = { ownerTeamId: pick.toTeamId, acquiredVia: "trade", acquiredTransactionId: transactionId };
    if (row) {
      await ctx.db.patch("draftPickInventory", row._id, moved);
      effects.push({
        inventoryId: row._id,
        created: false,
        prevOwnerTeamId: row.ownerTeamId,
        prevAcquiredVia: row.acquiredVia,
        prevAcquiredTransactionId: row.acquiredTransactionId,
        nextOwnerTeamId: pick.toTeamId,
      });
    } else {
      const inventoryId = await ctx.db.insert("draftPickInventory", {
        franchiseId,
        year: pick.year,
        round: pick.round,
        originTeamId: pick.originTeamId,
        ...moved,
      });
      effects.push({ inventoryId, created: true, nextOwnerTeamId: pick.toTeamId });
    }
  }
  return effects;
}

/** Puts picks back, newest first; a pick since used in a draft or traded on stays put. */
export async function undoPicks(ctx: MutationCtx, effects: readonly PickEffect[]) {
  for (const effect of [...effects].reverse()) {
    const row = await ctx.db.get("draftPickInventory", effect.inventoryId);
    if (!row || row.draftPickId !== undefined || row.ownerTeamId !== effect.nextOwnerTeamId) continue;
    if (effect.created || !effect.prevOwnerTeamId) {
      await ctx.db.delete("draftPickInventory", row._id);
      continue;
    }
    await ctx.db.patch("draftPickInventory", row._id, {
      ownerTeamId: effect.prevOwnerTeamId,
      acquiredVia: effect.prevAcquiredVia,
      acquiredTransactionId: effect.prevAcquiredTransactionId,
    });
  }
}
