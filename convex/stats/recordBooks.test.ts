/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  await t.mutation(internal.stats.recordBuild.start, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const owner = await asOwner(t);
  const list = async (
    book: "team" | "franchise" | "league",
    scope: "game" | "season" | "career",
    category: "passing" | "defense",
    statKey: string,
  ) => {
    const { lists } = await owner.query(api.stats.records.lists, { book, split: "regular", scope, category });
    return lists.find((l) => l.statKey === statKey)?.entries ?? [];
  };
  return { t, owner, list };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("records books", () => {
  test("the team book reaches back into real seasons; the franchise era does not; all-time has every team", async () => {
    const { owner, list } = await setup();
    expect((await owner.query(api.stats.recordBuild.status, {}))?.status).toBe("done");

    const team = await list("team", "season", "passing", "passYds");
    expect(team.some((e) => (e.year ?? 0) < SAMPLE_START_YEAR)).toBe(true);
    expect(team.every((e) => e.team?.abbr === "NE")).toBe(true);
    expect(team.length).toBeLessThanOrEqual(20);

    const era = await list("franchise", "season", "passing", "passYds");
    expect(era.length).toBeGreaterThan(0);
    expect(era.every((e) => (e.year ?? 0) >= SAMPLE_START_YEAR)).toBe(true);

    const league = await list("league", "season", "passing", "passYds");
    expect(new Set(league.map((e) => e.team?.abbr)).size).toBeGreaterThan(1);
    expect(league.map((e) => e.value)).toEqual([...league.map((e) => e.value)].sort((a, b) => b - a));

    const career = await list("league", "career", "passing", "passYds");
    expect(career[0]).toMatchObject({ rank: 1, firstYear: expect.any(Number) });
  });

  test("a player's page lists every book he makes", async () => {
    const { owner, list } = await setup();
    const [best] = await list("team", "season", "passing", "passYds");
    const placements = await owner.query(api.stats.records.forPlayer, { playerId: best!.player!.playerId });
    expect(new Set(placements.map((p) => p.book))).toEqual(new Set(["team", "franchise", "league"]));
    expect(placements[0]!.rank).toBe(1);
  });

  test("typed numbers join a list, replace the same player's, and go when removed", async () => {
    const { owner, list } = await setup();
    const typedId = await owner.mutation(api.stats.typedRecords.save, {
      book: "league",
      split: "regular",
      scope: "career",
      statKey: "sacks",
      name: "Bruce Smith",
      year: 2003,
      value: 200,
    });
    expect((await list("league", "career", "defense", "sacks"))[0]).toMatchObject({
      rank: 1,
      name: "Bruce Smith",
      value: 200,
      typedId,
      player: null,
    });

    const [top] = await list("league", "career", "passing", "passYds");
    await owner.mutation(api.stats.typedRecords.save, {
      book: "league",
      split: "regular",
      scope: "career",
      statKey: "passYds",
      name: top!.name,
      playerId: top!.player!.playerId,
      value: top!.value + 1000,
    });
    const after = await list("league", "career", "passing", "passYds");
    expect(after.filter((e) => e.player?.playerId === top!.player!.playerId)).toHaveLength(1);
    expect(after[0]!.value).toBe(top!.value + 1000);

    await owner.mutation(api.stats.typedRecords.remove, { typedId });
    expect((await list("league", "career", "defense", "sacks")).some((e) => e.name === "Bruce Smith")).toBe(
      false,
    );
    await expect(
      owner.mutation(api.stats.typedRecords.save, {
        book: "league",
        split: "regular",
        scope: "career",
        statKey: "sacks",
        name: "Nobody",
        value: -3,
      }),
    ).rejects.toThrow(/record number/);
  });

  test("a rebuild writes the same books again", async () => {
    const { t, owner, list } = await setup();
    const before = await list("league", "season", "passing", "passYds");
    await owner.mutation(api.stats.recordBuild.rebuild, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await list("league", "season", "passing", "passYds")).toEqual(before);
  });

  test("strangers are refused", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.mutation(api.stats.recordBuild.rebuild, {})).rejects.toThrow(/Not the owner/);
    await expect(
      stranger.mutation(api.stats.typedRecords.save, {
        book: "league",
        split: "regular",
        scope: "career",
        statKey: "sacks",
        name: "Bruce Smith",
        value: 200,
      }),
    ).rejects.toThrow(/Not the owner/);
  });
});
