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
  const sampleSeason = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!;
  return { t, owner, seasonId: sampleSeason._id };
}

describe("games/schedule", () => {
  test("lists the season in calendar order with a summary", async () => {
    const { owner, seasonId } = await setup();
    const { games, summary } = await owner.query(api.games.schedule.bySeason, { seasonId });
    expect(games.map((g) => g.weekKey)).toEqual(["w1", "w2", "w3", "w4", "w5", "w6", "w7"]);
    expect(games[6]).toMatchObject({ status: "scheduled", us: null, opponent: { abbr: "MIA" } });
    expect(games[3]).toMatchObject({ status: "bye", opponent: null });
    expect(games[0]).toMatchObject({ result: "W", us: 31, them: 17, opponent: { abbr: "LV" } });
    expect(games[0]!.stars.map((s) => s.name)).toEqual(["Drake Maye", "Stefon Diggs", "Opponent standout"]);
    expect(summary).toMatchObject({ regular: { w: 4, l: 1, t: 0 }, pointsFor: 140, streak: "W2" });
  });

  test("game detail has neighbours, the record entering the week and head-to-head", async () => {
    const { owner, seasonId } = await setup();
    const { games } = await owner.query(api.games.schedule.bySeason, { seasonId });
    const week5 = games.find((g) => g.weekKey === "w5")!;
    const detail = await owner.query(api.games.schedule.get, { gameId: week5._id });
    expect(detail.userRecordBefore).toEqual({ w: 2, l: 1, t: 0 });
    expect(detail.previousGameId).toBe(games.find((g) => g.weekKey === "w3")!._id);
    expect(detail.nextGameId).toBe(games.find((g) => g.weekKey === "w6")!._id);
    expect(detail.headToHead.record).toEqual({ w: 1, l: 0, t: 0 });
    expect(detail.headToHead.games[0]).toMatchObject({ year: SAMPLE_START_YEAR, us: 34, them: 30 });
  });

  test("notes save trimmed and clear when empty", async () => {
    const { t, owner, seasonId } = await setup();
    const { games } = await owner.query(api.games.schedule.bySeason, { seasonId });
    const gameId = games[1]!._id;
    await owner.mutation(api.games.schedule.updateNotes, { gameId, notes: "  Comeback win.  " });
    expect((await t.run((ctx) => ctx.db.get("games", gameId)))!.notes).toBe("Comeback win.");
    await owner.mutation(api.games.schedule.updateNotes, { gameId, notes: "   " });
    expect((await t.run((ctx) => ctx.db.get("games", gameId)))!.notes).toBeUndefined();
  });

  test("signed-out callers are refused", async () => {
    const { t, seasonId } = await setup();
    await expect(t.query(api.games.schedule.bySeason, { seasonId })).rejects.toThrow(/Sign in required/);
  });
});
