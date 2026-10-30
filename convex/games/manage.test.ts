/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const teams = await owner.query(api.league.teams.list, {});
  const team = (abbr: string) => teams.find((x) => x.abbr === abbr)!._id;
  const schedule = () => owner.query(api.games.schedule.bySeason, { seasonId });
  const week = async (weekKey: string) => (await schedule()).games.find((g) => g.weekKey === weekKey)!;
  const season = () => t.run((ctx) => ctx.db.get("seasons", seasonId));
  const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  const mayeYards = async () => {
    const rows = await owner.query(api.stats.season.bySplit, { seasonId, split: "regular" });
    return rows.find((r) => r.name === "Drake Maye")?.totals.passYds;
  };
  return { t, owner, seasonId, team, schedule, week, season, settle, mayeYards };
}

describe("games/manage", () => {
  test("creates a played game for the user's team and refreshes the season record", async () => {
    const { owner, seasonId, team, schedule, season, settle } = await setup();
    const gameId = await owner.mutation(api.games.manage.create, {
      seasonId,
      weekKey: "w8",
      bye: false,
      opponentTeamId: team("BUF"),
      userIsHome: false,
      us: 21,
      them: 24,
      overtime: true,
      dateLabel: " Sun, Oct 26 ",
      stadium: "Highmark Stadium",
      weather: "Snow",
      notes: "Lost it late.",
    });
    await settle();
    const game = (await schedule()).games.find((g) => g._id === gameId)!;
    expect(game).toMatchObject({
      weekKey: "w8",
      result: "L",
      us: 21,
      them: 24,
      overtime: true,
      userIsHome: false,
    });
    expect(game.dateLabel).toBe("Sun, Oct 26");
    const detail = await owner.query(api.games.schedule.get, { gameId });
    expect(detail?.header).toEqual({
      stadium: "Highmark Stadium",
      weather: "Snow",
      neutralSite: false,
      lineScore: null,
      quartersFromPlays: false,
    });
    expect((await season())!.userRecord).toMatchObject({ w: 4, l: 2 });
  });

  test("adds a bye and a scheduled game, and refuses a week that already has one", async () => {
    const { owner, seasonId, team, schedule } = await setup();
    await owner.mutation(api.games.manage.create, { seasonId, weekKey: "w9", bye: true });
    await owner.mutation(api.games.manage.create, {
      seasonId,
      weekKey: "wc",
      bye: false,
      opponentTeamId: team("KC"),
    });
    const { games } = await schedule();
    expect(games.find((g) => g.weekKey === "w9")).toMatchObject({ status: "bye", opponent: null });
    expect(games.find((g) => g.weekKey === "wc")).toMatchObject({
      status: "scheduled",
      playoffRound: "wc",
      us: null,
    });
    await expect(
      owner.mutation(api.games.manage.create, {
        seasonId,
        weekKey: "w1",
        bye: false,
        opponentTeamId: team("KC"),
      }),
    ).rejects.toThrow(/already has a game/);
  });

  test("edits the score and moves the week, carrying the stat lines along", async () => {
    const { t, owner, week, season, settle } = await setup();
    const w1 = await week("w1");
    const edit = { bye: false, opponentTeamId: w1.opponent!._id, userIsHome: true };
    await owner.mutation(api.games.manage.update, {
      gameId: w1._id,
      weekKey: "w1",
      ...edit,
      us: 10,
      them: 17,
    });
    expect((await season())!.userRecord).toMatchObject({ w: 3, l: 2 });
    // Saving the same header again changes nothing.
    await owner.mutation(api.games.manage.update, {
      gameId: w1._id,
      weekKey: "w1",
      ...edit,
      us: 10,
      them: 17,
    });
    expect((await season())!.userRecord).toMatchObject({ w: 3, l: 2 });

    await owner.mutation(api.games.manage.update, {
      gameId: w1._id,
      weekKey: "pre1",
      ...edit,
      us: 10,
      them: 17,
    });
    await settle();
    const lines = await t.run((ctx) =>
      ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", w1._id))
        .take(50),
    );
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.weekKey === "pre1")).toBe(true);
    // A preseason game no longer counts toward the regular-season record.
    expect((await season())!.userRecord).toMatchObject({ w: 3, l: 1 });
  });

  test("refuses to drop a side that has box score lines", async () => {
    const { owner, week } = await setup();
    const w1 = await week("w1");
    await expect(
      owner.mutation(api.games.manage.update, { gameId: w1._id, weekKey: "w1", bye: true }),
    ).rejects.toThrow(/box score lines/);
  });

  test("deletes a game with its lines, and season totals follow", async () => {
    const { t, owner, week, season, settle, mayeYards } = await setup();
    const w2 = await week("w2");
    expect(await mayeYards()).toBe(1403);
    await owner.mutation(api.games.manage.remove, { gameId: w2._id });
    await settle();
    expect(await t.run((ctx) => ctx.db.get("games", w2._id))).toBeNull();
    // An open game page reads null rather than throwing once its game is gone.
    expect(await owner.query(api.games.schedule.get, { gameId: w2._id })).toBeNull();
    // Week 2's 301 passing yards are gone.
    expect(await mayeYards()).toBe(1102);
    expect((await season())!.userRecord).toMatchObject({ w: 3, l: 1 });
    const milestones = await t.run((ctx) =>
      ctx.db
        .query("milestones")
        .withIndex("by_gameId", (q) => q.eq("gameId", w2._id))
        .take(10),
    );
    expect(milestones).toEqual([]);
  });

  test("strangers and signed-out callers are refused", async () => {
    const { t, seasonId, week } = await setup();
    const stranger = await asStranger(t);
    await expect(
      stranger.mutation(api.games.manage.create, { seasonId, weekKey: "w9", bye: true }),
    ).rejects.toThrow(/Not the owner/);
    const w1 = await week("w1");
    await expect(t.mutation(api.games.manage.remove, { gameId: w1._id })).rejects.toThrow(/Sign in required/);
  });
});
