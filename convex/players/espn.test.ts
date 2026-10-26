/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

const ARCH = 4870906;
const athlete = (school: string, position: string) => ({
  athlete: {
    displayName: "Arch Manning",
    firstName: "Arch",
    lastName: "Manning",
    position: { abbreviation: position },
    team: { abbreviation: school === "Texas" ? "TEX" : "ALA", location: school },
    displayExperience: "Senior",
    displayHeight: `6' 4"`,
    displayWeight: "222 lbs",
    headshot: { href: "https://a.espncdn.com/x.png" },
  },
});

/** ESPN with Arch Manning in college football only; `school` sets where ESPN has him. */
function stubEspn(school = "Texas", position = "QB") {
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.includes("/search?"))
      return Response.json({
        items: url.includes("league=college-football")
          ? [{ id: String(ARCH), displayName: "Arch Manning" }]
          : [],
      });
    if (url.includes(`/college-football/athletes/${ARCH}`)) return Response.json(athlete(school, position));
    return new Response("not found", { status: 404 });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.OWNER_EMAILS;
});

async function withCreatedProspect() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  const owner = await asOwner(t);
  await owner.mutation(api.franchise.setup.create, { name: "Draft", teamAbbr: "NE", startYear: 2026 });
  const playerId = await t.run(async (ctx) => {
    const franchise = (await ctx.db.query("franchises").first())!;
    return await ctx.db.insert("players", {
      franchiseId: franchise._id,
      firstName: "Arch",
      lastName: "Manning",
      displayName: "Arch Manning",
      position: "QB",
      college: "Texas",
      isReal: false,
      retired: false,
      aliases: [],
    });
  });
  return { owner, playerId };
}

describe("players/espn college matching", () => {
  test("a created prospect matches his college record and keeps the college headshot path", async () => {
    stubEspn();
    const { owner, playerId } = await withCreatedProspect();
    const [suggestion] = await owner.action(api.players.espn.suggest, { playerIds: [playerId] });
    expect(suggestion?.candidate).toMatchObject({
      espnId: ARCH,
      league: "college",
      college: "Texas",
      classYear: "Senior",
      headshotUrl: expect.stringContaining("/college-football/"),
    });

    await owner.action(api.players.espn.confirm, { playerId, espnId: ARCH, league: "college" });
    const page = await owner.query(api.players.player.get, { playerId });
    expect(page.player).toMatchObject({ espnId: ARCH, espnLeague: "college", isReal: true, heightIn: 76 });
    expect(page.headshotUrl).toContain(`/college-football/players/full/${ARCH}.png`);
  });

  test("a namesake at another school or position is not suggested, only listed", async () => {
    stubEspn("Alabama", "LB");
    const { owner, playerId } = await withCreatedProspect();
    const [suggestion] = await owner.action(api.players.espn.suggest, { playerIds: [playerId] });
    expect(suggestion?.candidate).toBeNull();
    const results = await owner.action(api.players.espn.search, { playerId });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ league: "college", college: "Alabama" });
  });

  test("signed-out callers cannot search ESPN", async () => {
    stubEspn();
    const t = convexTest(schema, modules);
    await expect(t.action(api.players.espn.suggest, { playerIds: [] })).rejects.toThrow(/Sign in required/);
  });
});
