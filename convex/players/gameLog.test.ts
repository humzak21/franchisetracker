/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const player = (name: string) =>
    t.run(async (ctx) => {
      const found = await ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", name),
        )
        .first();
      return found!;
    });
  return { t, owner, player };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("a career game log", () => {
  test("runs every season in order, and a filter keeps the big games", async () => {
    const { owner, player } = await setup();
    const henderson = await player("TreVeyon Henderson");
    const all = await owner.query(api.players.gameLog.career, { playerId: henderson._id });
    expect(all.map((r) => r.weekKey)).toEqual(["w1", "w2", "w3", "w5", "w6"]);
    expect(all[0]?.year).toBe(SAMPLE_START_YEAR);
    const big = await owner.query(api.players.gameLog.career, {
      playerId: henderson._id,
      filter: { statKey: "rushYds", min: 100 },
    });
    expect(big.map((r) => r.weekKey)).toEqual(["w5", "w6"]);
  });

  test("refuses a stat that does not exist, and a stranger", async () => {
    const { t, owner, player } = await setup();
    const henderson = await player("TreVeyon Henderson");
    await expect(
      owner.query(api.players.gameLog.career, {
        playerId: henderson._id,
        filter: { statKey: "nope", min: 1 },
      }),
    ).rejects.toThrow("Unknown stat");
    const stranger = await asStranger(t);
    await expect(stranger.query(api.players.gameLog.career, { playerId: henderson._id })).rejects.toThrow();
  });
});
