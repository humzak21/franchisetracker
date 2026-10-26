/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { NFL_TEAMS } from "../../shared/domain";
import { api, internal } from "../_generated/api";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

// Root-relative so keys stay uniform ("/convex/league/seed.ts"); a "../**" glob yields
// "./seed.ts" for this directory, which convex-test cannot resolve.
const modules = import.meta.glob("/convex/**/*.ts");

describe("league/seed:seedTeams", () => {
  test("inserts 32 teams once and refreshes them on re-run", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(internal.league.seed.seedTeams, {})).toEqual({ inserted: 32, updated: 0 });
    expect(await t.mutation(internal.league.seed.seedTeams, {})).toEqual({ inserted: 0, updated: 32 });
    const teams = await t.run(async (ctx) => await ctx.db.query("teams").take(100));
    expect(teams).toHaveLength(NFL_TEAMS.length);
    expect(await t.run(async (ctx) => await ctx.db.query("franchises").take(1))).toEqual([]);
  });
});

describe("league/teams:list", () => {
  test("orders teams by conference, division, then city", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.league.seed.seedTeams, {});
    const owner = await asOwner(t);
    const teams = await owner.query(api.league.teams.list, {});
    expect(teams).toHaveLength(32);
    const keys = teams.map((team) => `${team.conference}|${team.division}|${team.city}`);
    expect(keys).toEqual([...keys].sort());
    expect(teams[0]).toMatchObject({ conference: "AFC", division: "East", city: "Buffalo" });
  });
});
