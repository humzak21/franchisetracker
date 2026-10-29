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
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const league = () => owner.query(api.stats.league.bySeason, { seasonId });
  const row = async (name: string) => (await league()).rows.find((r) => r.name === name)!;
  return { t, owner, active, seasonId, league, row };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("editing season stats", () => {
  test("another team's captured line changes in place", async () => {
    const { owner, seasonId, row } = await setup();
    const allen = await row("Josh Allen");
    const at = { playerId: allen.playerId, seasonId, teamId: allen.teamId, split: "regular" as const };
    await owner.mutation(api.stats.edit.setStat, { ...at, stat: "passYds", value: 1500 });
    await owner.mutation(api.stats.edit.setStat, { ...at, stat: "gamesPlayed", value: 6 });
    expect(await row("Josh Allen")).toMatchObject({ gamesPlayed: 6, totals: { passYds: 1500 } });
    // His page lists the captured season too, so it can be edited there.
    const page = await owner.query(api.players.player.get, { playerId: allen.playerId });
    expect(page.seasons.find((s) => s.year === SAMPLE_START_YEAR)?.stats).toMatchObject({
      source: "reported",
      totals: { passYds: 1500 },
    });
  });

  test("log totals take the typed number as an override, and clearing it goes back to the logs", async () => {
    const { owner, seasonId, row } = await setup();
    const maye = await row("Drake Maye");
    expect(maye.totals.passYds).toBe(1403);
    const at = { playerId: maye.playerId, seasonId, teamId: maye.teamId, split: "regular" as const };
    await owner.mutation(api.stats.edit.setStat, { ...at, stat: "passYds", value: 1500 });
    const season = await owner.query(api.stats.season.bySplit, { seasonId, split: "regular" });
    expect(season.find((r) => r.playerId === maye.playerId)).toMatchObject({
      totals: { passYds: 1500 },
      overridden: ["passYds"],
    });
    await owner.mutation(api.stats.edit.setStat, { ...at, stat: "passYds", value: null });
    const back = await owner.query(api.stats.season.bySplit, { seasonId, split: "regular" });
    expect(back.find((r) => r.playerId === maye.playerId)).toMatchObject({
      totals: { passYds: 1403 },
      overridden: [],
    });
    await expect(
      owner.mutation(api.stats.edit.setStat, { ...at, split: "postseason", stat: "passYds", value: 1 }),
    ).rejects.toThrow(/No stats|game logs/);
  });

  test("imported history totals change, with their averages and the career", async () => {
    const { t, owner, active } = await setup();
    const imported = await t.run(async (ctx) =>
      (await ctx.db.query("seasonPlayerStats").take(500)).find(
        (r) => r.source === "import" && r.split === "regular" && (r.totals.passYds ?? 0) > 0,
      ),
    );
    if (!imported) throw new Error("the sample has imported passing seasons");
    expect(imported.franchiseId).toBe(active.franchise._id);
    await owner.mutation(api.stats.edit.setStat, {
      playerId: imported.playerId,
      seasonId: imported.seasonId,
      teamId: imported.teamId,
      split: "regular",
      stat: "passYds",
      value: 9999,
    });
    const after = await t.run((ctx) => ctx.db.get("seasonPlayerStats", imported._id));
    expect(after?.totals.passYds).toBe(9999);
    const career = await t.run((ctx) =>
      ctx.db
        .query("careerPlayerStats")
        .withIndex("by_playerId", (q) => q.eq("playerId", imported.playerId))
        .take(4),
    );
    expect(career.find((c) => c.split === "regular")?.totals.passYds).toBeGreaterThanOrEqual(9999);
  });

  test("rates, bad numbers and strangers are refused", async () => {
    const { t, owner, seasonId, row } = await setup();
    const maye = await row("Drake Maye");
    const at = { playerId: maye.playerId, seasonId, teamId: maye.teamId, split: "regular" as const };
    await expect(
      owner.mutation(api.stats.edit.setStat, { ...at, stat: "passRating", value: 99 }),
    ).rejects.toThrow(/rates/);
    await expect(
      owner.mutation(api.stats.edit.setStat, { ...at, stat: "passYds", value: 10.5 }),
    ).rejects.toThrow(/whole number/);
    const stranger = await asStranger(t);
    await expect(
      stranger.mutation(api.stats.edit.setStat, { ...at, stat: "passYds", value: 1 }),
    ).rejects.toThrow();
  });
});
