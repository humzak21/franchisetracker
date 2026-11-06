/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
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
  // The sample's games have no team stats: give the first one passing yards and a defensive sack.
  const { games } = await owner.query(api.games.schedule.bySeason, { seasonId });
  const first = games.find((g) => g.status === "played" && g.opponent)!;
  await owner.mutation(api.games.statLines.setTeamStat, {
    gameId: first._id,
    teamId: active.franchise.userTeamId,
    statKey: "passYds",
    value: 300,
  });
  await owner.mutation(api.games.statLines.setTeamStat, {
    gameId: first._id,
    teamId: first.opponent!._id,
    statKey: "sacksAllowed",
    value: 4,
  });
  /** Removes the sample's league screen line for the user team, so its game totals show. */
  const dropOwnLeagueLine = () =>
    t.run(async (ctx) => {
      const own = await ctx.db
        .query("leagueTeamStats")
        .withIndex("by_seasonId_and_teamId", (q) =>
          q.eq("seasonId", seasonId).eq("teamId", active.franchise.userTeamId),
        )
        .unique();
      if (own) await ctx.db.delete("leagueTeamStats", own._id);
    });
  return { t, owner, active, seasonId, dropOwnLeagueLine };
}

beforeEach(() => {
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  delete process.env.AUTH_TEST_MODE;
});

const statPoint = async (owner: Awaited<ReturnType<typeof asOwner>>, statKey: string, year: number) =>
  (await owner.query(api.league.teamStats.trends, {}))
    .find((s) => s.statKey === statKey)
    ?.points.find((p) => p.year === year);

describe("team season stats", () => {
  test("the user team has a League → Teams row from its games before the screen is captured", async () => {
    const { owner, seasonId, dropOwnLeagueLine } = await setup();
    await dropOwnLeagueLine();
    const ne = (await owner.query(api.league.teamStats.leagueBySeason, { seasonId })).find((r) => r.isUser);
    expect(ne).toMatchObject({ fromGames: true });
    expect(ne?.stats.pointsAllowed).toBeGreaterThan(0);
    expect(ne?.stats).toMatchObject({ passYds: 300, sacks: 4 });
  });

  test("a season's rank and league average come from League → Teams; a captured rank wins", async () => {
    const { t, owner, active, seasonId } = await setup();
    await t.run(async (ctx) => {
      const teams = await ctx.db.query("teams").take(64);
      const others = teams.filter((team) => !["NE", "BUF", "MIA", "NYJ"].includes(team.abbr)).slice(0, 8);
      for (const [i, team] of others.entries()) {
        await ctx.db.insert("leagueTeamStats", {
          franchiseId: active.franchise._id,
          seasonId,
          teamId: team._id,
          stats: { passYds: 900 + i * 100, pointsPg: 15 + i },
        });
      }
    });
    const passing = await statPoint(owner, "passYardsPg", SAMPLE_START_YEAR);
    expect(passing?.rank).not.toBeNull();
    expect(passing?.of).toBeGreaterThanOrEqual(9);
    expect(passing?.average).not.toBeNull();
    // The sample captured 3rd from the team stats screen.
    expect(await statPoint(owner, "pointsPg", SAMPLE_START_YEAR)).toMatchObject({ rank: 3 });
  });

  test("the league screen replaces the games, a typed value replaces both, and clearing goes back", async () => {
    const { owner, seasonId, dropOwnLeagueLine } = await setup();
    expect((await statPoint(owner, "passYardsPg", SAMPLE_START_YEAR))?.source).toBe("league");
    await dropOwnLeagueLine();
    const derived = await statPoint(owner, "passYardsPg", SAMPLE_START_YEAR);
    expect(derived?.source).toBe("games");

    await owner.mutation(api.league.teamStatsEdit.setSeason, {
      seasonId,
      statKey: "passYardsPg",
      value: 301.5,
      rank: 4,
      tied: true,
    });
    await owner.mutation(api.league.teamStatsEdit.setSeason, {
      seasonId,
      statKey: "passYardsPg",
      value: 302.5,
      rank: 4,
      tied: true,
    });
    expect(await statPoint(owner, "passYardsPg", SAMPLE_START_YEAR)).toMatchObject({
      value: 302.5,
      rank: 4,
      tied: true,
      source: "captured",
    });

    await owner.mutation(api.league.teamStatsEdit.clearSeason, { seasonId, statKey: "passYardsPg" });
    expect(await statPoint(owner, "passYardsPg", SAMPLE_START_YEAR)).toMatchObject({
      value: derived?.value,
      source: "games",
    });
  });

  test("ranks out of range are refused and strangers are kept out", async () => {
    const { t, owner, seasonId } = await setup();
    await expect(
      owner.mutation(api.league.teamStatsEdit.setSeason, { seasonId, statKey: "sacks", value: 40, rank: 0 }),
    ).rejects.toThrow(/rank/);
    await expect(
      t.mutation(api.league.teamStatsEdit.setSeason, { seasonId, statKey: "sacks", value: 40 }),
    ).rejects.toThrow(/Sign in required/);
  });
});
