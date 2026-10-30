/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SECOND_FRANCHISE_NAME } from "../dev/fixtureDashboard";
import { SAMPLE_FRANCHISE_NAME } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";
import { SWEEP_TABLES } from "./remove";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const [sample, second] = await owner.query(api.franchise.franchises.list, {});
  const remove = (franchiseId: Id<"franchises">, confirmName: string) =>
    owner.mutation(api.franchise.remove.remove, { franchiseId, confirmName });
  return { t, owner, sample: sample!, second: second!, remove };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Tokens belong to the owner, not to the franchise that was active when they were made. */
const KEPT = new Set(["ingestionTokens"]);

describe("deleting a franchise", () => {
  test("every table holding a franchise's rows is swept", () => {
    const owned = Object.entries(schema.tables).flatMap(([name, table]) => {
      const fields = (table.validator as { fields?: Record<string, unknown> }).fields ?? {};
      return "franchiseId" in fields ? [name] : [];
    });
    const swept = new Set<string>(SWEEP_TABLES);
    expect(owned.filter((name) => !swept.has(name) && !KEPT.has(name))).toEqual([]);
  });

  test("refuses a wrong name, then removes every row of an inactive one", async () => {
    const { t, owner, sample, second, remove } = await setup();
    await owner.mutation(api.franchise.franchises.activate, { franchiseId: second._id });
    await expect(remove(sample._id, "Sample")).rejects.toThrow(/Type the franchise's name/);
    expect(
      (await owner.query(api.franchise.franchises.list, {})).find((f) => f._id === sample._id)?.deleting,
    ).toBe(false);

    await remove(sample._id, SAMPLE_FRANCHISE_NAME);
    const deleting = await owner.query(api.franchise.franchises.list, {});
    expect(deleting.find((f) => f._id === sample._id)?.deleting).toBe(true);
    await expect(
      owner.mutation(api.franchise.franchises.activate, { franchiseId: sample._id }),
    ).rejects.toThrow(/no longer exists/);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await t.run(async (ctx) => {
      let count = 0;
      for (const table of [
        "seasons",
        "players",
        "games",
        "gameStatLines",
        "seasonPlayerStats",
        "standings",
      ] as const) {
        const rows = await ctx.db.query(table).take(5000);
        count += rows.filter((r) => r.franchiseId === sample._id).length;
      }
      return count;
    });
    expect(left).toBe(0);
    expect((await owner.query(api.franchise.franchises.list, {})).map((f) => f.name)).toEqual([
      SECOND_FRANCHISE_NAME,
    ]);
    expect((await owner.query(api.franchise.franchises.getActive, {}))!.franchise.name).toBe(
      SECOND_FRANCHISE_NAME,
    );
  });

  test("deleting the active one hands over to the franchise used most recently", async () => {
    const { t, owner, sample, remove } = await setup();
    await owner.mutation(api.franchise.setup.create, { name: "Lions", teamAbbr: "DET", startYear: 2028 });
    // The newest franchise (Lions) is active; the sample was left just now, the second never was.
    await expect(remove(sample._id, "Lions")).rejects.toThrow(/Type the franchise's name/);
    const lions = (await owner.query(api.franchise.franchises.getActive, {}))!.franchise;
    await remove(lions._id, "  Lions ");

    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    expect(active.franchise.name).toBe(SAMPLE_FRANCHISE_NAME);
    const list = await owner.query(api.franchise.franchises.list, {});
    expect(list.filter((f) => f.isActive).map((f) => f.name)).toEqual([SAMPLE_FRANCHISE_NAME]);
    expect(list.find((f) => f._id === lions._id)).toMatchObject({ isActive: false, deleting: true });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await owner.query(api.franchise.franchises.list, {})).map((f) => f.name)).toEqual([
      SAMPLE_FRANCHISE_NAME,
      SECOND_FRANCHISE_NAME,
    ]);
  });

  test("deleting the last franchise leaves none active, for first-run setup", async () => {
    const { t, owner, sample, second, remove } = await setup();
    await remove(second._id, SECOND_FRANCHISE_NAME);
    await remove(sample._id, SAMPLE_FRANCHISE_NAME);
    expect(await owner.query(api.franchise.franchises.getActive, {})).toBeNull();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await owner.query(api.franchise.franchises.list, {})).toEqual([]);

    await owner.mutation(api.franchise.setup.create, { name: "Fresh", teamAbbr: "DET", startYear: 2028 });
    expect((await owner.query(api.franchise.franchises.getActive, {}))!.franchise.name).toBe("Fresh");
  });

  test("only the owner may delete", async () => {
    const { t, sample } = await setup();
    const stranger = await asStranger(t);
    await expect(
      stranger.mutation(api.franchise.remove.remove, {
        franchiseId: sample._id,
        confirmName: SAMPLE_FRANCHISE_NAME,
      }),
    ).rejects.toThrow(/Not the owner/);
  });
});
