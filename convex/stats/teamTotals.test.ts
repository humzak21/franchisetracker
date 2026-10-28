/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { weekPhase } from "../../shared/domain";
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
  const season = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!;
  const { games } = await owner.query(api.games.schedule.bySeason, { seasonId: season._id });
  const played = games.filter((g) => g.status === "played" && g.opponent);
  return { t, owner, active, season, played };
}

const pointsOf = (trends: { statKey: string; points: { year: number }[] }[], statKey: string) =>
  trends.find((tr) => tr.statKey === statKey)?.points.find((p) => p.year === SAMPLE_START_YEAR);

beforeEach(() => {
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  delete process.env.AUTH_TEST_MODE;
});

describe("team season stats from the games", () => {
  test("a game's team stats roll into the season, and captured values still win", async () => {
    const { owner, active, season, played } = await setup();
    const [first] = played;
    const userTeamId = active.franchise.userTeamId;
    await owner.mutation(api.games.statLines.setTeamStat, {
      gameId: first!._id,
      teamId: userTeamId,
      statKey: "passYds",
      value: 300,
    });
    await owner.mutation(api.games.statLines.setTeamStat, {
      gameId: first!._id,
      teamId: first!.opponent!._id,
      statKey: "sacksAllowed",
      value: 4,
    });

    const trends = await owner.query(api.league.teamStats.trends, {});
    expect(pointsOf(trends, "passYardsPg")).toEqual({
      year: SAMPLE_START_YEAR,
      value: 300,
      rank: null,
      tied: false,
      source: "games",
    });
    // The sample franchise captured its points per game and sacks; those override the games.
    expect(pointsOf(trends, "pointsPg")).toMatchObject({ value: 28, rank: 3, source: "captured" });
    expect(pointsOf(trends, "sacks")).toMatchObject({ value: 17, rank: 7, source: "captured" });

    const refreshed = (await owner.query(api.franchise.franchises.getActive, {}))!.seasons.find(
      (s) => s._id === season._id,
    );
    const scored = played.filter((g) => weekPhase(g.weekKey) === "regular");
    expect(refreshed?.teamTotals).toMatchObject({
      games: scored.length,
      statGames: 1,
      stats: {
        passYardsPg: 300,
        sacks: 4,
        pointsPg: scored.reduce((sum, g) => sum + g.us!, 0) / scored.length,
      },
    });
  });

  test("the rebuild fills in seasons and running it twice changes nothing", async () => {
    const { t, owner, season } = await setup();
    await t.run((ctx) => ctx.db.patch("seasons", season._id, { teamTotals: undefined }));
    await t.mutation(internal.stats.teamTotals.rebuildFranchise, { franchiseId: season.franchiseId });
    const once = (await owner.query(api.franchise.franchises.getActive, {}))!.seasons;
    await t.mutation(internal.stats.teamTotals.rebuildFranchise, { franchiseId: season.franchiseId });
    const twice = (await owner.query(api.franchise.franchises.getActive, {}))!.seasons;
    expect(once.find((s) => s._id === season._id)?.teamTotals?.games).toBeGreaterThan(0);
    expect(twice).toEqual(once);
  });

  test("only the owner reads them", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.league.teamStats.trends, {})).rejects.toThrow();
  });
});
