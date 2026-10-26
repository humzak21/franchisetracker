/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  return { t, owner, seasonId };
}

describe("dashboard", () => {
  test("the season: header line, last result, next opponent and the pulse", async () => {
    const { owner, seasonId } = await setup();
    const home = (await owner.query(api.dashboard.home.season, { seasonId }))!;
    expect(home.summary).toMatchObject({ regular: { w: 4, l: 1, t: 0 }, streak: "W2" });
    expect(home.divisionRank).toBe(1);
    expect(home.lastGame).toMatchObject({ weekKey: "w6", us: 28, them: 14, opponent: { abbr: "NO" } });
    expect(home.nextGame).toMatchObject({
      game: { weekKey: "w7", status: "scheduled", opponent: { abbr: "MIA" } },
      opponentRecord: { w: 2, l: 3, t: 0 },
      headToHead: { record: { w: 1, l: 0, t: 0 }, last: { weekKey: "w2", us: 27, them: 24 } },
    });
    expect(home.pulse.map((p) => [p.weekKey, p.margin, p.streak])).toEqual([
      ["w1", 14, 1],
      ["w2", 3, 2],
      ["w3", -3, -1],
      ["w5", 4, 1],
      ["w6", 14, 2],
    ]);
  });

  test("recent moves and injuries are the user team's", async () => {
    const { owner, seasonId } = await setup();
    const recent = await owner.query(api.dashboard.activity.recent, { seasonId });
    expect(recent.moves.length).toBeGreaterThan(0);
    expect(recent.moves.length).toBeLessThanOrEqual(5);
    expect(recent.injuries.map((i) => i.player.name).length).toBeGreaterThan(0);
  });

  test("rivals, team rank trends and the palette's games", async () => {
    const { owner } = await setup();
    const rivals = await owner.query(api.league.rivals.list, {});
    expect(rivals.map((r) => r.opponent.abbr).sort()).toEqual(["BUF", "LV", "MIA", "NO", "PIT"]);
    expect(rivals.find((r) => r.opponent.abbr === "PIT")).toMatchObject({
      record: { w: 0, l: 1, t: 0 },
      streak: "L1",
      margins: [-3],
    });

    const trends = await owner.query(api.league.teamStats.trends, {});
    const points = trends.find((t) => t.statKey === "pointsPg")!.points;
    expect(points.map((p) => [p.year, p.rank])).toEqual([
      [SAMPLE_START_YEAR - 1, 11],
      [SAMPLE_START_YEAR, 3],
    ]);

    const games = await owner.query(api.games.directory.all, {});
    expect(games[0]).toMatchObject({ weekKey: "w7", opponentAbbr: "MIA", result: null });
    expect(games.at(-1)).toMatchObject({ weekKey: "w1", opponentName: "Las Vegas Raiders", us: 31 });
  });

  test("signed-out callers are refused", async () => {
    const { t, seasonId } = await setup();
    await expect(t.query(api.dashboard.home.season, { seasonId })).rejects.toThrow(/Sign in required/);
    await expect(t.query(api.league.rivals.list, {})).rejects.toThrow(/Sign in required/);
    await expect(t.query(api.games.directory.all, {})).rejects.toThrow(/Sign in required/);
  });
});
