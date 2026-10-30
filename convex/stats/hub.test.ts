/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
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
  const roster = await owner.query(api.players.roster.bySeason, { seasonId: season._id });
  const id = (name: string) => roster.entries.find((e) => e.player.displayName === name)!.player._id;
  return { t, owner, active, season, id };
}

describe("stats/hub:overview", () => {
  test("reads the season's record, leaders and what it set", async () => {
    const { t, owner, active, season, id } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("milestones", {
        franchiseId: active.franchise._id,
        key: "mark:test",
        seasonId: season._id,
        weekKey: "w3",
        kind: "mark",
        statKey: "passYds",
        title: "Drake Maye passes 1,000 yards",
        acknowledged: false,
        detectedAt: 0,
      });
      await ctx.db.insert("milestones", {
        franchiseId: active.franchise._id,
        key: "high:test",
        seasonId: season._id,
        kind: "career_high",
        title: "A career high",
        acknowledged: false,
        detectedAt: 0,
      });
    });
    const data = (await owner.query(api.stats.hub.overview, { seasonId: season._id }))!;
    expect(data.played).toBeGreaterThan(0);
    expect(data.record.w + data.record.l + data.record.t).toBe(data.played);
    expect(data.pointsFor).toBeGreaterThan(0);
    expect(data.leaders.find((l) => l.key === "passing")?.player.playerId).toBe(id("Drake Maye"));
    const titles = data.setThisSeason.map((m) => m.title);
    expect(titles).toContain("Drake Maye passes 1,000 yards");
    expect(titles).not.toContain("A career high");
  });

  test("another franchise's season reads as nothing, and strangers are refused", async () => {
    const { t, season } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.stats.hub.overview, { seasonId: season._id })).rejects.toThrow();
    await expect(stranger.query(api.stats.hub.countdownsFor, { seasonId: season._id })).rejects.toThrow();
  });
});

describe("stats/hub:countdownsFor", () => {
  test("lists rostered players a season from a mark, and drops anyone released", async () => {
    const { t, owner, active, season, id } = await setup();
    const career = (playerId: Id<"players">, totals: Record<string, number>) =>
      t.run(async (ctx) => {
        const rows = await ctx.db
          .query("careerPlayerStats")
          .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
          .collect();
        for (const row of rows) await ctx.db.delete("careerPlayerStats", row._id);
        await ctx.db.insert("careerPlayerStats", {
          franchiseId: active.franchise._id,
          playerId,
          seasons: 2,
          split: "regular",
          gamesPlayed: 34,
          totals,
        });
      });
    const diggs = id("Stefon Diggs");
    await career(diggs, { recYds: 4950 });
    const list = await owner.query(api.stats.hub.countdownsFor, { seasonId: season._id });
    expect(list.find((c) => c.player.playerId === diggs)).toMatchObject({
      statKey: "recYds",
      mark: 5000,
      remaining: 50,
      gamesAway: 1,
    });

    await t.run(async (ctx) => {
      const entries = await ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", diggs).eq("seasonId", season._id))
        .collect();
      for (const entry of entries) await ctx.db.patch("rosterEntries", entry._id, { status: "released" });
    });
    const after = await owner.query(api.stats.hub.countdownsFor, { seasonId: season._id });
    expect(after.map((c) => c.player.playerId)).not.toContain(diggs);
  });
});

describe("stats/trends", () => {
  test("a player's seasons, games with the team, and the season's live state", async () => {
    const { t, owner, active, season, id } = await setup();
    const maye = id("Drake Maye");
    const data = await owner.query(api.stats.trends.player, { playerId: maye });
    const sample = data.seasons.find((s) => s.year === SAMPLE_START_YEAR);
    expect(sample?.imported).toBe(false);
    expect(sample?.gamesPlayed).toBe(data.games.filter((g) => g.year === SAMPLE_START_YEAR).length);
    expect(sample?.age).not.toBeNull();

    await t.run((ctx) =>
      ctx.db.patch("seasons", season._id, { status: "regular", userRecord: { w: 3, l: 1, t: 0 } }),
    );
    expect((await owner.query(api.stats.trends.player, { playerId: maye })).live).toEqual({
      year: SAMPLE_START_YEAR,
      teamGames: 4,
    });
    expect(active.franchise.settings.gamesPerSeason).toBe(data.gamesPerSeason);
  });

  test("a player's game for another team is not on their curve", async () => {
    const { t, owner, active, id } = await setup();
    const maye = id("Drake Maye");
    const before = await owner.query(api.stats.trends.player, { playerId: maye });
    await t.run(async (ctx) => {
      const line = await ctx.db
        .query("gameStatLines")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", maye))
        .first();
      const other = (await ctx.db.query("teams").take(40)).find((x) => x._id !== active.franchise.userTeamId);
      await ctx.db.patch("gameStatLines", line!._id, { teamId: other!._id });
    });
    const after = await owner.query(api.stats.trends.player, { playerId: maye });
    expect(after.games).toHaveLength(before.games.length - 1);
  });

  test("the team's seasons carry their regular-season scores, oldest first", async () => {
    const { owner } = await setup();
    const { seasons } = await owner.query(api.stats.trends.team, {});
    const sample = seasons.find((s) => s.year === SAMPLE_START_YEAR)!;
    expect(sample.games.length).toBeGreaterThan(0);
    expect(sample.pointsFor).toBe(sample.games.reduce((n, g) => n + g.pointsFor, 0));
    expect(sample.record.w + sample.record.l + sample.record.t).toBeGreaterThanOrEqual(sample.games.length);
  });
});
