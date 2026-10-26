/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  return { t, owner: await asOwner(t) };
}

describe("franchise/setup:create", () => {
  test("there is no franchise until the owner creates one", async () => {
    const { owner } = await setup();
    expect(await owner.query(api.franchise.franchises.getActive, {})).toBeNull();
  });

  test("creates the franchise with its first season", async () => {
    const { owner } = await setup();
    await owner.mutation(api.franchise.setup.create, {
      name: "  Lions Rebuild ",
      teamAbbr: "DET",
      startYear: 2026,
    });
    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    expect(active.franchise).toMatchObject({ name: "Lions Rebuild", startYear: 2026, isActive: true });
    expect(active.franchise.settings).toEqual({ gamesPerSeason: 17, playoffTeams: 14 });
    expect(active.userTeam.abbr).toBe("DET");
    expect(active.seasons.map((s) => [s.year, s.status])).toEqual([[2026, "upcoming"]]);
  });

  test("refuses a second franchise and bad input", async () => {
    const { owner } = await setup();
    const create = (args: { name: string; teamAbbr: string; startYear: number }) =>
      owner.mutation(api.franchise.setup.create, args);
    await expect(create({ name: " ", teamAbbr: "NE", startYear: 2026 })).rejects.toThrow(
      /Name the franchise/,
    );
    await expect(create({ name: "X", teamAbbr: "NE", startYear: 1066 })).rejects.toThrow(/First season/);
    await expect(create({ name: "X", teamAbbr: "ZZZ", startYear: 2026 })).rejects.toThrow(
      /Team ZZZ not found/,
    );
    await create({ name: "First", teamAbbr: "NE", startYear: 2026 });
    await expect(create({ name: "Second", teamAbbr: "KC", startYear: 2026 })).rejects.toThrow(
      /already exists/,
    );
  });

  test("signed-out callers cannot create a franchise", async () => {
    const { t } = await setup();
    await expect(
      t.mutation(api.franchise.setup.create, { name: "X", teamAbbr: "NE", startYear: 2026 }),
    ).rejects.toThrow(/Sign in required/);
  });
});
