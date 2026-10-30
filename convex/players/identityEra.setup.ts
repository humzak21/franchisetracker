/** Shared by the identity tests. Two dots in the name keep it out of what Convex bundles. */
import { convexTest } from "convex-test";
import { vi } from "vitest";
import type { RowTargetKey } from "../../shared/ingestion/rows/targets";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

export type Draft = Doc<"extractions">["draft"];

export async function setup(modules: Record<string, () => Promise<unknown>>) {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const franchiseId = active.franchise._id;
  const season = (year: number) => active.seasons.find((s) => s.year === year)!._id;
  const first = season(SAMPLE_START_YEAR);
  const later = season(SAMPLE_START_YEAR + 1);
  const image = () =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })));
  const read = async (
    targetKey: RowTargetKey | "game_box_score" | "game_log",
    seasonId: Id<"seasons">,
    weekKey?: "w1",
  ) => {
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [await image()],
      source: "web",
      targetKey,
      seasonId,
      weekKey,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const draft: Draft = (await owner.query(api.ingestion.review.get, { setKey: setKey! })).extraction!.draft;
    return { setKey: setKey!, draft };
  };
  const named = (displayName: string) =>
    t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", franchiseId).eq("displayName", displayName),
        )
        .take(10),
    );
  const addPlayer = (fields: Partial<Doc<"players">> & { displayName: string }) =>
    t.run((ctx) =>
      ctx.db.insert("players", {
        franchiseId,
        firstName: "",
        lastName: fields.displayName,
        position: "WR",
        isReal: true,
        retired: false,
        aliases: [],
        ...fields,
      }),
    );
  const teamId = (abbr: string) =>
    t.run(
      async (ctx) =>
        (await ctx.db
          .query("teams")
          .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
          .unique())!._id,
    );
  return { t, owner, active, franchiseId, first, later, read, named, addPlayer, teamId };
}
