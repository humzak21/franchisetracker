/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
  await t.mutation(internal.stats.recordBuild.start, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const season = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!;
  const player = (name: string) =>
    t.run(async (ctx) => {
      const found = await ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", name),
        )
        .first();
      return found!;
    });
  return { t, owner, season, seasons: active.seasons, player };
}

const groupOf = <G extends { key: string }>(sections: readonly { groups: readonly G[] }[], key: string) =>
  sections.flatMap((s) => s.groups).find((g) => g.key === key);

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("a player's splits", () => {
  test("home and away add up to the regular season", async () => {
    const { owner, player } = await setup();
    const maye = await player("Drake Maye");
    const { sections, seasons } = await owner.query(api.stats.splits.player, {
      playerId: maye._id,
      seasonId: "all",
    });
    expect(seasons.length).toBeGreaterThan(0);
    const regular = groupOf(sections, "regular")!;
    const home = groupOf(sections, "home")?.gamesPlayed ?? 0;
    const away = groupOf(sections, "away")?.gamesPlayed ?? 0;
    expect(regular.gamesPlayed).toBeGreaterThan(0);
    expect(home + away).toBe(regular.gamesPlayed);
    const yards = (key: string) => groupOf(sections, key)?.totals.passYds ?? 0;
    expect(yards("home") + yards("away")).toBe(yards("regular"));
  });

  test("narrows to one season", async () => {
    const { owner, player, season } = await setup();
    const maye = await player("Drake Maye");
    const whole = await owner.query(api.stats.splits.player, { playerId: maye._id, seasonId: "all" });
    const one = await owner.query(api.stats.splits.player, { playerId: maye._id, seasonId: season._id });
    const games = (r: typeof whole) => groupOf(r.sections, "regular")?.gamesPlayed ?? 0;
    expect(games(one)).toBeLessThanOrEqual(games(whole));
    expect(one.seasons).toEqual(whole.seasons);
  });

  test("a stranger is refused", async () => {
    const { t, player } = await setup();
    const maye = await player("Drake Maye");
    const stranger = await asStranger(t);
    await expect(
      stranger.query(api.stats.splits.player, { playerId: maye._id, seasonId: "all" }),
    ).rejects.toThrow();
  });
});

describe("the team's splits", () => {
  test("wins and losses match the games, and the quarters match the scores", async () => {
    const { t, owner, season } = await setup();
    const { sections, quarters } = await owner.query(api.stats.splits.team, { seasonId: season._id });
    const games = await t.run((ctx) =>
      ctx.db
        .query("games")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", season._id))
        .take(40),
    );
    const played = games.filter((g) => g.status === "played" && weekPhase(g.weekKey) === "regular");
    const regular = groupOf(sections, "regular")!;
    expect(regular.games).toBe(played.length);
    expect(regular.wins + regular.losses + regular.ties).toBe(played.length);
    const scored = played.filter((g) => g.lineScore).length;
    expect(quarters.games).toBeLessThanOrEqual(played.length);
    expect(quarters.games).toBeGreaterThanOrEqual(scored);
  });

  test("all seasons is at least one season", async () => {
    const { owner, season } = await setup();
    const one = await owner.query(api.stats.splits.team, { seasonId: season._id });
    const all = await owner.query(api.stats.splits.team, { seasonId: "all" });
    const games = (r: typeof one) => groupOf(r.sections, "regular")?.games ?? 0;
    expect(games(all)).toBeGreaterThanOrEqual(games(one));
  });

  test("a real season before the franchise has no games to split", async () => {
    const { owner, seasons } = await setup();
    const real = seasons.find((s) => s.year < SAMPLE_START_YEAR);
    if (!real) return;
    const { sections } = await owner.query(api.stats.splits.team, { seasonId: real._id });
    expect(sections).toEqual([]);
  });

  test("a stranger is refused", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.stats.splits.team, { seasonId: "all" })).rejects.toThrow();
  });
});
