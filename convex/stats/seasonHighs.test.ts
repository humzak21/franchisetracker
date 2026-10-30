/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { confirmNew } from "../lib/testDraft";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const regular = () => owner.query(api.stats.season.bySplit, { seasonId, split: "regular" });
  return { t, owner, seasonId, regular };
}

describe("season highs", () => {
  test("each high points at the game it came in", async () => {
    const { t, regular } = await setup();
    const rows = await regular();
    const henderson = rows.find((r) => r.name === "TreVeyon Henderson")!;
    // 88 + 64 + 97 + 121 + 108: the 121-yard game is the high.
    const high = henderson.bestGames.rushYds!;
    expect(high.value).toBe(121);
    const line = await t.run((ctx) =>
      ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_playerId", (q) =>
          q.eq("gameId", high.gameId).eq("playerId", henderson.playerId),
        )
        .unique(),
    );
    expect(line).toMatchObject({ weekKey: high.weekKey, stats: { rushYds: 121 } });
    // 284 + 301 + 221 + 342 + 255
    expect(rows.find((r) => r.name === "Drake Maye")!.bestGames.passYds).toMatchObject({ value: 342 });
  });

  test("a committed game that beats the high takes it over, with its game and week", async () => {
    const { t, owner, seasonId, regular } = await setup();
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [
        await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(8)], { type: "image/png" }))),
      ],
      source: "web",
      targetKey: "game_box_score",
      seasonId,
      weekKey: "w7",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const draft = (await owner.query(api.ingestion.review.get, { setKey: setKey! })).extraction!.draft;
    if (draft.target !== "game_box_score") throw new Error("wrong target");
    draft.lines.find((l) => l.name === "S. Diggs")!.stats.recYds = 200;
    await owner.mutation(api.ingestion.review.commit, { setKey: setKey!, draft: confirmNew(draft) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const game = await t.run((ctx) =>
      ctx.db
        .query("games")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", "w7"))
        .first(),
    );
    const diggs = (await regular()).find((r) => r.name === "Stefon Diggs")!;
    expect(diggs.bestGames.recYds).toEqual({ value: 200, gameId: game!._id, weekKey: "w7" });
  });

  test("the rebuild restores highs and counts on rows written before they existed", async () => {
    const { t, regular } = await setup();
    const before = await regular();
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("seasonPlayerStats").take(500);
      for (const row of rows)
        await ctx.db.patch("seasonPlayerStats", row._id, { bestGames: undefined, thresholdCounts: {} });
    });
    expect((await regular()).every((r) => Object.keys(r.bestGames).length === 0)).toBe(true);

    expect(await t.mutation(internal.stats.rebuild.all, {})).toBeGreaterThan(0);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await regular();
    const byId = (rows: typeof before, id: Id<"players">) => rows.find((r) => r.playerId === id);
    for (const row of before) {
      expect(byId(after, row.playerId)).toMatchObject({
        bestGames: row.bestGames,
        thresholdCounts: row.thresholdCounts,
      });
    }
    // Running it again changes nothing.
    await t.mutation(internal.stats.rebuild.all, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await regular()).toHaveLength(after.length);
  }, 120_000);
});
