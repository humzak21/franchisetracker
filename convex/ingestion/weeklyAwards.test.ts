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
  const images = (n: number) =>
    Promise.all(
      Array.from({ length: n }, () =>
        t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" }))),
      ),
    );
  const batch = () => owner.query(api.ingestion.weeklyAwards.batch, { seasonId });
  return { t, owner, active, seasonId, images, batch };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("weekly awards batch", () => {
  test("uploaded together, given weeks afterwards, read and committed in one go", async () => {
    const { t, owner, seasonId, images, batch } = await setup();
    const keys = await owner.mutation(api.ingestion.weeklyAwards.create, {
      seasonId,
      storageIds: await images(3),
    });
    // One set per screenshot, none read until it has a week.
    expect(keys).toHaveLength(3);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await batch()).map((s) => [s.status, s.weekKey])).toEqual([
      ["queued", null],
      ["queued", null],
      ["queued", null],
    ]);

    await owner.mutation(api.ingestion.weeklyAwards.setWeek, { setKey: keys[0]!, weekKey: "w4" });
    await owner.mutation(api.ingestion.weeklyAwards.setWeek, { setKey: keys[1]!, weekKey: "w5" });
    expect(await owner.mutation(api.ingestion.weeklyAwards.readAll, { setKeys: keys })).toBe(2);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const read = await batch();
    expect(
      read
        .filter((s) => s.status === "review")
        .map((s) => s.weekKey)
        .sort(),
    ).toEqual(["w4", "w5"]);
    expect(read.find((s) => s.weekKey === "w4")).toMatchObject({ winners: 2, ready: true });

    // A week can still change before commit, without reading again.
    await owner.mutation(api.ingestion.weeklyAwards.setWeek, { setKey: keys[1]!, weekKey: "w6" });
    expect(await owner.mutation(api.ingestion.weeklyAwards.commitReady, { setKeys: keys })).toBe(2);
    const awards = await owner.query(api.awards.awards.bySeason, { seasonId });
    const weeks = awards.filter((a) => a.type === "OPOW" && a.name === "Drake Maye").map((a) => a.weekKey);
    expect(weeks).toEqual(expect.arrayContaining(["w4", "w6"]));
    await expect(
      owner.mutation(api.ingestion.weeklyAwards.setWeek, { setKey: keys[0]!, weekKey: "w7" }),
    ).rejects.toThrow(/already committed/);
    // Committing twice is a no-op.
    expect(await owner.mutation(api.ingestion.weeklyAwards.commitReady, { setKeys: keys })).toBe(0);
  });

  test("a winner nobody knows waits for review instead of being added unseen", async () => {
    const { t, owner, active, seasonId, images, batch } = await setup();
    const named = (displayName: string) =>
      t.run((ctx) =>
        ctx.db
          .query("players")
          .withIndex("by_franchiseId_and_displayName", (q) =>
            q.eq("franchiseId", active.franchise._id).eq("displayName", displayName),
          )
          .first(),
      );
    const gonzalez = (await named("Christian Gonzalez"))!;
    await t.run(async (ctx) => {
      const entries = await ctx.db.query("rosterEntries").collect();
      for (const entry of entries.filter((e) => e.playerId === gonzalez._id))
        await ctx.db.delete("rosterEntries", entry._id);
      await ctx.db.delete("players", gonzalez._id);
    });

    const [key] = await owner.mutation(api.ingestion.weeklyAwards.create, {
      seasonId,
      storageIds: await images(1),
    });
    await owner.mutation(api.ingestion.weeklyAwards.setWeek, { setKey: key!, weekKey: "w9" });
    await owner.mutation(api.ingestion.weeklyAwards.readAll, { setKeys: [key!] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await batch()).find((s) => s.setKey === key)).toMatchObject({ winners: 2, ready: false });
    expect(await owner.mutation(api.ingestion.weeklyAwards.commitReady, { setKeys: [key!] })).toBe(0);
    expect(await named("C. Gonzalez")).toBeNull();

    // Review sees the name, and committing from there adds them.
    const draft = (await owner.query(api.ingestion.review.get, { setKey: key! })).extraction!.draft;
    await owner.mutation(api.ingestion.review.commit, { setKey: key!, draft });
    expect(await named("C. Gonzalez")).not.toBeNull();
  });

  test("is private", async () => {
    const { t, seasonId } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.ingestion.weeklyAwards.batch, { seasonId })).rejects.toThrow();
    await expect(stranger.mutation(api.ingestion.weeklyAwards.readAll, { setKeys: [] })).rejects.toThrow();
  });
});
