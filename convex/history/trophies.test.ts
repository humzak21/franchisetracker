/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

describe("history/trophies", () => {
  test("adds and removes real-history entries", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.franchise.seed.seedInitial, {});
    const owner = await asOwner(t);
    const entryId = await owner.mutation(api.history.trophies.addEntry, {
      year: 2019,
      kind: "superBowl",
      note: " LIII ",
    });
    const overview = await owner.query(api.history.trophies.overview, {});
    expect(overview.seasons).toHaveLength(10);
    expect(overview.entries).toMatchObject([{ year: 2019, kind: "superBowl", note: "LIII" }]);
    await owner.mutation(api.history.trophies.removeEntry, { entryId });
    expect((await owner.query(api.history.trophies.overview, {})).entries).toEqual([]);
  });

  test("rejects impossible years and signed-out writes", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.franchise.seed.seedInitial, {});
    const owner = await asOwner(t);
    await expect(
      owner.mutation(api.history.trophies.addEntry, { year: 19, kind: "division" }),
    ).rejects.toThrow(/Year must be/);
    await expect(t.mutation(api.history.trophies.addEntry, { year: 2001, kind: "division" })).rejects.toThrow(
      /Sign in required/,
    );
  });
});
