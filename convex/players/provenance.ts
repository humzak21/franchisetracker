/** Where a new player came from, and what that says about whether they are a real person. */
import type { PlayerOrigin } from "../../shared/domain";
import { derivedIsReal } from "../../shared/players/provenance";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";

export async function provenanceOf(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  seasonId: Id<"seasons"> | undefined,
  origin: PlayerOrigin,
) {
  const franchise = must(await ctx.db.get("franchises", franchiseId), "Franchise");
  const season = seasonId ? await ctx.db.get("seasons", seasonId) : null;
  const createdYear = season?.year ?? null;
  return {
    origin,
    createdSeasonId: seasonId,
    lastSeenYear: season?.year,
    isReal: derivedIsReal({ origin, createdYear, startYear: franchise.startYear }),
  };
}

/** A commit named this player in `year`: the sighting carry-over and retirements read. */
export async function markSeen(ctx: MutationCtx, player: Doc<"players">, year: number) {
  if ((player.lastSeenYear ?? 0) < year) await ctx.db.patch("players", player._id, { lastSeenYear: year });
}
