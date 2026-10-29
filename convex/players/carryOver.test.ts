/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
  const season = (year: number) => active.seasons.find((s) => s.year === year)!._id;
  const roster = (seasonId: Id<"seasons">, teamId = active.franchise.userTeamId) =>
    t.run((ctx) =>
      ctx.db
        .query("rosterEntries")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
        .take(200),
    );
  return { t, owner, active, season, roster };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("roster carry-over", () => {
  test("brings the previous season's roster in a year older, once", async () => {
    const { t, owner, season, roster } = await setup();
    const before = await roster(season(SAMPLE_START_YEAR));
    const [released, injured] = before;
    await t.run(async (ctx) => {
      await ctx.db.patch("rosterEntries", released!._id, { status: "released", statusWeekKey: "w4" });
      await ctx.db.patch("rosterEntries", injured!._id, { status: "ir", statusWeekKey: "w9" });
    });
    const next = season(SAMPLE_START_YEAR + 1);
    expect(await roster(next)).toHaveLength(0);

    const result = await owner.mutation(api.players.carryOver.fromPreviousSeason, { seasonId: next });
    expect(result).toEqual({ added: before.length - 1, fromYear: SAMPLE_START_YEAR });
    const after = await roster(next);
    expect(after.map((e) => e.playerId)).not.toContain(released!.playerId);
    const carried = after.find((e) => e.playerId === injured!.playerId)!;
    expect(carried).toMatchObject({
      status: "active",
      age: injured!.age! + 1,
      exp: injured!.exp! + 1,
      ovr: injured!.ovr,
      jersey: injured!.jersey,
    });
    expect(carried.statusWeekKey).toBeUndefined();

    expect(await owner.mutation(api.players.carryOver.fromPreviousSeason, { seasonId: next })).toEqual({
      added: 0,
      fromYear: SAMPLE_START_YEAR,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await roster(next)).toHaveLength(after.length);
  });

  test("other teams' rosters follow in their own mutations, and players already placed are skipped", async () => {
    const { t, owner, active, season, roster } = await setup();
    const from = season(SAMPLE_START_YEAR);
    const next = season(SAMPLE_START_YEAR + 1);
    const other = (await t.run((ctx) => ctx.db.query("teams").take(2))).find(
      (team) => team._id !== active.franchise.userTeamId,
    )!;
    const [signed, ...rest] = await roster(from);
    await t.run(async (ctx) => {
      // He signed with another team in the offseason and that move is already recorded.
      const { _id, _creationTime, ...entry } = signed!;
      await ctx.db.insert("rosterEntries", { ...entry, seasonId: next, teamId: other._id });
      await ctx.db.insert("rosterEntries", { ...entry, teamId: other._id, partial: true });
    });
    const theirs = await roster(from, other._id);
    await owner.mutation(api.players.carryOver.fromPreviousSeason, { seasonId: next });
    expect((await roster(next)).map((e) => e.playerId).sort()).toEqual(rest.map((e) => e.playerId).sort());
    expect(await roster(next, other._id)).toHaveLength(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const carried = await roster(next, other._id);
    expect(carried.map((e) => e.playerId).sort()).toEqual(theirs.map((e) => e.playerId).sort());
    expect(carried.filter((e) => e.playerId === signed!.playerId)).toHaveLength(1);
  });

  test("starting a season carries the roster on its own", async () => {
    const { t, owner, season, roster } = await setup();
    const next = season(SAMPLE_START_YEAR + 1);
    await owner.mutation(api.players.carryOver.fromPreviousSeason, { seasonId: next });
    await t.run((ctx) => ctx.db.patch("seasons", next, { status: "complete" }));
    const added = await owner.mutation(api.seasons.lifecycle.advance, { seasonId: next });
    expect(await roster(added)).toHaveLength((await roster(next)).length);
  });

  test("the first season and strangers are refused", async () => {
    const { t, owner, season } = await setup();
    await expect(
      owner.mutation(api.players.carryOver.fromPreviousSeason, { seasonId: season(SAMPLE_START_YEAR) }),
    ).rejects.toThrow(/first season/);
    const stranger = await asStranger(t);
    await expect(
      stranger.mutation(api.players.carryOver.fromPreviousSeason, {
        seasonId: season(SAMPLE_START_YEAR + 1),
      }),
    ).rejects.toThrow(/Not the owner/);
  });
});
