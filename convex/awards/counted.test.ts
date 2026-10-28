/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
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
  return { t, owner, seasonId };
}

const winners = (
  counted: { type: string; contenders: { name: string; value: number }[] }[],
  type: string,
) => {
  const contenders = counted.find((c) => c.type === type)!.contenders;
  return contenders.filter((c) => c.value === contenders[0]?.value).map((c) => c.name);
};

describe("league stats", () => {
  test("the user team from its logs and the rest of the league from captured season stats", async () => {
    const { owner, seasonId } = await setup();
    const { rows, teams } = await owner.query(api.stats.league.bySeason, { seasonId });
    const maye = rows.find((r) => r.name === "Drake Maye")!;
    expect(maye).toMatchObject({ isUser: true, source: "logs" });
    expect(maye.totals.passYds).toBe(1403);
    const allen = rows.find((r) => r.name === "Josh Allen")!;
    expect(allen).toMatchObject({ isUser: false, source: "reported", gamesPlayed: 5 });
    expect(teams.find((t) => t._id === allen.teamId)?.abbr).toBe("BUF");
    // Opponents' box score lines are partial seasons, never league totals.
    expect(rows.every((r) => r.isUser || r.source === "reported")).toBe(true);
  });

  test("is private", async () => {
    const { t, seasonId } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.stats.league.bySeason, { seasonId })).rejects.toThrow();
  });
});

describe("counted awards", () => {
  test("league leaders from league stats and the most players of the week", async () => {
    const { owner, seasonId } = await setup();
    const counted = await owner.query(api.awards.counted.bySeason, { seasonId });
    expect(winners(counted, "SackLeader")).toEqual(["Zach Sieler"]);
    expect(winners(counted, "BallHawk")).toEqual(["Sauce Gardner"]);
    expect(winners(counted, "HeatSeeker")).toEqual(["Terrel Bernard"]);
    expect(winners(counted, "MostOPOW")).toEqual(["Drake Maye"]);
    expect(winners(counted, "MostDPOW")).toEqual(["Christian Gonzalez"]);
    const fpoy = counted.find((c) => c.type === "FPOY")!.contenders;
    expect(fpoy[0]!.statLine).toMatch(/fantasy pts$/);
    expect(fpoy.some((c) => c.isUser)).toBe(true);
  });

  test("an assigned winner replaces the stored one, and clearing removes it", async () => {
    const { t, owner, seasonId } = await setup();
    const playerId = await t.run(
      async (ctx) => (await ctx.db.query("players").take(500)).find((p) => p.lastName === "Gardner")!._id,
    );
    await owner.mutation(api.awards.assign.assign, {
      seasonId,
      type: "BallHawk",
      playerId,
      statLine: "5 INT",
    });
    await owner.mutation(api.awards.assign.assign, { seasonId, type: "BallHawk", playerId });
    let awards = await owner.query(api.awards.awards.bySeason, { seasonId });
    const ballHawk = awards.filter((a) => a.type === "BallHawk");
    expect(ballHawk).toHaveLength(1);
    expect(ballHawk[0]).toMatchObject({ name: "Sauce Gardner", isUser: false, team: { abbr: "NYJ" } });

    await owner.mutation(api.awards.assign.assign, { seasonId, type: "BestDB", conference: "AFC", playerId });
    await owner.mutation(api.awards.assign.clear, { seasonId, type: "BallHawk" });
    awards = await owner.query(api.awards.awards.bySeason, { seasonId });
    expect(awards.filter((a) => a.type === "BallHawk")).toEqual([]);
    expect(awards.filter((a) => a.type === "BestDB")).toHaveLength(1);
    // Weekly awards stay out of reach: a season award has one winner, a week has many.
    expect(awards.filter((a) => a.type === "DPOW")).toHaveLength(1);
  });

  test("weekly awards, honors and strangers are refused", async () => {
    const { t, owner, seasonId } = await setup();
    const playerId = await t.run(async (ctx) => (await ctx.db.query("players").first())!._id);
    await expect(
      owner.mutation(api.awards.assign.assign, { seasonId, type: "OPOW", playerId }),
    ).rejects.toThrow(/not a one-winner season award/);
    await expect(owner.mutation(api.awards.assign.clear, { seasonId, type: "ProBowl" })).rejects.toThrow();
    const stranger = await asStranger(t);
    await expect(stranger.mutation(api.awards.assign.clear, { seasonId, type: "FPOY" })).rejects.toThrow();
    await expect(stranger.query(api.awards.counted.bySeason, { seasonId })).rejects.toThrow();
  });
});
