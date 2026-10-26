/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { NFL_TEAMS, USER_TEAM_ABBR } from "../../shared/domain";
import { api, internal } from "../_generated/api";
import schema from "../schema";

// Root-relative so keys stay uniform ("/convex/franchise/seed.ts"); a "../**" glob yields
// "./seed.ts" for this directory, which convex-test cannot resolve.
const modules = import.meta.glob("/convex/**/*.ts");

describe("franchise/seed:seedInitial", () => {
  test("creates 32 teams, one franchise and 10 season shells", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(internal.franchise.seed.seedInitial, {});
    expect(result).toMatchObject({
      teamsInserted: 32,
      teamsUpdated: 0,
      franchiseCreated: true,
      seasonsInserted: 10,
    });

    const counts = await t.run(async (ctx) => ({
      teams: (await ctx.db.query("teams").take(100)).length,
      franchises: (await ctx.db.query("franchises").take(10)).length,
      seasons: (await ctx.db.query("seasons").take(100)).length,
    }));
    expect(counts).toEqual({ teams: NFL_TEAMS.length, franchises: 1, seasons: 10 });
  });

  test("is idempotent on a second run", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.franchise.seed.seedInitial, {});
    const second = await t.mutation(internal.franchise.seed.seedInitial, {});
    expect(second).toEqual({
      teamsInserted: 0,
      teamsUpdated: 32,
      franchiseCreated: false,
      franchiseId: first.franchiseId,
      seasonsInserted: 0,
    });

    const counts = await t.run(async (ctx) => ({
      teams: (await ctx.db.query("teams").take(100)).length,
      franchises: (await ctx.db.query("franchises").take(10)).length,
      seasons: (await ctx.db.query("seasons").take(100)).length,
    }));
    expect(counts).toEqual({ teams: 32, franchises: 1, seasons: 10 });
  });
});

describe("franchise/franchises:getActive", () => {
  test("returns null before seeding", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.franchise.franchises.getActive, {})).toBeNull();
  });

  test("returns the franchise with user team NE and seasons ascending", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.franchise.seed.seedInitial, {});
    const active = await t.query(api.franchise.franchises.getActive, {});
    expect(active).not.toBeNull();
    expect(active!.franchise.name).toBe("Patriots Dynasty");
    expect(active!.franchise.settings).toEqual({ gamesPerSeason: 17, playoffTeams: 14 });
    expect(active!.userTeam.abbr).toBe(USER_TEAM_ABBR);
    expect(active!.seasons.map((s) => s.year)).toEqual([
      2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034,
    ]);
    expect(active!.seasons.every((s) => s.status === "upcoming")).toBe(true);
  });
});

describe("league/teams:list", () => {
  test("orders teams by conference, division, then city", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.franchise.seed.seedInitial, {});
    const teams = await t.query(api.league.teams.list, {});
    expect(teams).toHaveLength(32);
    const keys = teams.map((team) => `${team.conference}|${team.division}|${team.city}`);
    expect(keys).toEqual([...keys].sort());
    expect(teams[0]).toMatchObject({ conference: "AFC", division: "East", city: "Buffalo" });
  });
});
