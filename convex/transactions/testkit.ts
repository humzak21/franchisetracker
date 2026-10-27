/**
 * Test helpers for the transaction tests: the seeded sample franchise and lookups into rosters
 * and pick inventory. Type-only test imports, so this module is inert when pushed.
 */
import type { TestConvex } from "convex-test";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import type schema from "../schema";

export const blank = { playersIn: [], playersOut: [], picksIn: [], picksOut: [] };

/** Seeds teams and the sample franchise; returns the owner and lookups for its current season. */
export async function seeded(t: TestConvex<typeof schema>) {
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const team = async (abbr: string) =>
    (await t.run((ctx) =>
      ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
        .unique(),
    ))!._id;
  const maye = (await t.run((ctx) =>
    ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_displayName", (q) =>
        q.eq("franchiseId", active.franchise._id).eq("displayName", "Drake Maye"),
      )
      .first(),
  ))!._id;
  const entries = (playerId: Id<"players">) =>
    t.run((ctx) =>
      ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
        .take(10),
    );
  const picks = () =>
    t.run((ctx) =>
      ctx.db
        .query("draftPickInventory")
        .withIndex("by_franchiseId_and_ownerTeamId_and_year", (q) =>
          q.eq("franchiseId", active.franchise._id),
        )
        .take(50)
        // Only picks that recorded trades moved; the sample has a couple of its own.
        .then((rows) => rows.filter((r) => r.acquiredTransactionId !== undefined)),
    );
  const playerNamed = async (name: string) =>
    (await t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", name),
        )
        .first(),
    ))!._id;
  return { t, owner, seasonId, ne: active.franchise.userTeamId, team, maye, entries, picks, playerNamed };
}
