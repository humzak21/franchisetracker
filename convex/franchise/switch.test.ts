/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { SECOND_FRANCHISE_NAME } from "../dev/fixtureDashboard";
import { SAMPLE_FRANCHISE_NAME, SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  return { t, owner: await asOwner(t) };
}

describe("several franchises", () => {
  test("lists every franchise, the active one first", async () => {
    const { owner } = await setup();
    const list = await owner.query(api.franchise.franchises.list, {});
    expect(list.map((f) => [f.name, f.isActive, f.userTeam.abbr])).toEqual([
      [SAMPLE_FRANCHISE_NAME, true, "NE"],
      [SECOND_FRANCHISE_NAME, false, "KC"],
    ]);
    expect(list[0]!.latest).toMatchObject({ year: SAMPLE_START_YEAR + 1, status: "upcoming" });
  });

  test("switching moves every screen to the other franchise and back, leaving data alone", async () => {
    const { owner } = await setup();
    const [sample, second] = await owner.query(api.franchise.franchises.list, {});
    const sampleSeason = (await owner.query(api.franchise.franchises.getActive, {}))!.seasons.find(
      (s) => s.year === SAMPLE_START_YEAR,
    )!;

    await owner.mutation(api.franchise.franchises.activate, { franchiseId: second!._id });
    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    expect(active.franchise.name).toBe(SECOND_FRANCHISE_NAME);
    expect(active.userTeam.abbr).toBe("KC");
    expect(active.seasons.map((s) => s.year)).toEqual([2030]);
    // Season-scoped screens refuse the other franchise's season instead of showing it.
    expect(await owner.query(api.dashboard.home.season, { seasonId: sampleSeason._id })).toBeNull();
    expect(await owner.query(api.games.directory.all, {})).toEqual([]);
    expect(await owner.query(api.league.rivals.list, {})).toEqual([]);

    await owner.mutation(api.franchise.franchises.activate, { franchiseId: sample!._id });
    expect((await owner.query(api.games.directory.all, {})).length).toBe(6);
    const list = await owner.query(api.franchise.franchises.list, {});
    expect(list.filter((f) => f.isActive).map((f) => f.name)).toEqual([SAMPLE_FRANCHISE_NAME]);
  });

  test("a new franchise becomes the only active one", async () => {
    const { t, owner } = await setup();
    await owner.mutation(api.franchise.setup.create, { name: "Lions", teamAbbr: "DET", startYear: 2028 });
    const list = await owner.query(api.franchise.franchises.list, {});
    expect(list.filter((f) => f.isActive).map((f) => f.name)).toEqual(["Lions"]);
    expect(list).toHaveLength(3);
    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    expect(active.seasons.map((s) => s.year)).toEqual([2028]);
    const jobs = await t.run((ctx) =>
      ctx.db
        .query("historyImports")
        .withIndex("by_franchiseId", (q) => q.eq("franchiseId", active.franchise._id))
        .take(5),
    );
    expect(jobs).toHaveLength(1);
  });

  test("the inbox, tokens and Shortcut follow the active franchise", async () => {
    const { t, owner } = await setup();
    const [sample, second] = await owner.query(api.franchise.franchises.list, {});
    await t.run((ctx) =>
      ctx.db.insert("ingestionTokens", { franchiseId: sample!._id, tokenHash: "hash", createdAt: 1 }),
    );
    await owner.mutation(api.franchise.franchises.activate, { franchiseId: second!._id });
    expect(await owner.query(api.ingestion.tokens.list, {})).toHaveLength(1);
    expect(await owner.query(api.ingestion.inbox.pendingCount, {})).toBe(0);
  });

  test("only the owner may list or switch", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.franchise.franchises.list, {})).rejects.toThrow(/Not the owner/);
    const franchiseId = await t.run(async (ctx) => (await ctx.db.query("franchises").first())!._id);
    await expect(stranger.mutation(api.franchise.franchises.activate, { franchiseId })).rejects.toThrow(
      /Not the owner/,
    );
  });
});
