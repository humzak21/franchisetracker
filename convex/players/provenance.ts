/** Where a new player came from, and what that says about whether they are a real person. */
import type { PlayerOrigin } from "../../shared/domain";
import { derivedIsReal } from "../../shared/players/provenance";
import type { Id } from "../_generated/dataModel";
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
    isReal: derivedIsReal({ origin, createdYear, startYear: franchise.startYear }),
  };
}
