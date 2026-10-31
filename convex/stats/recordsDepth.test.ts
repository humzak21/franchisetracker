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
  return { t, owner, franchise: active.franchise, userTeam: active.userTeam, season, player };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("single-game lists", () => {
  test("hold a player's next-best games, each naming its game", async () => {
    const { owner } = await setup();
    const { lists } = await owner.query(api.stats.records.lists, {
      book: "franchise",
      split: "regular",
      scope: "game",
      category: "passing",
    });
    const entries = lists.find((l) => l.statKey === "passYds")?.entries ?? [];
    const maye = entries.filter((e) => e.name === "Drake Maye");
    expect(maye.length).toBeGreaterThan(1);
    expect(maye.length).toBeLessThanOrEqual(3);
    expect(maye.every((e) => e.gameId !== null && e.weekKey !== null)).toBe(true);
    expect(new Set(maye.map((e) => e.gameId)).size).toBe(maye.length);
  });

  test("the team book takes them too, and a player's page lists each one", async () => {
    const { owner, player } = await setup();
    const { lists } = await owner.query(api.stats.records.lists, {
      book: "team",
      split: "regular",
      scope: "game",
      category: "passing",
    });
    const entries = lists.find((l) => l.statKey === "passYds")?.entries ?? [];
    expect(entries.filter((e) => e.name === "Drake Maye").length).toBeGreaterThan(1);
    const maye = await player("Drake Maye");
    const placements = await owner.query(api.stats.records.forPlayer, { playerId: maye._id });
    const games = placements.filter(
      (p) => p.book === "team" && p.scope === "game" && p.statKey === "passYds",
    );
    expect(new Set(games.map((g) => g.weekKey)).size).toBe(games.length);
    expect(games.length).toBeGreaterThan(1);
  });
});

describe("rows from before games were kept", () => {
  test("Rebuild stats gives them their games, in every book", async () => {
    const { t, owner, season } = await setup();
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("seasonPlayerStats")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id))
        .take(500);
      for (const row of rows) await ctx.db.patch("seasonPlayerStats", row._id, { topGames: undefined });
    });
    await owner.mutation(api.stats.rebuild.start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    for (const book of ["franchise", "team"] as const) {
      const { lists } = await owner.query(api.stats.records.lists, {
        book,
        split: "regular",
        scope: "game",
        category: "passing",
      });
      const entries = lists.find((l) => l.statKey === "passYds")?.entries ?? [];
      expect(entries.filter((e) => e.name === "Drake Maye" && e.gameId !== null).length).toBeGreaterThan(1);
    }
  }, 180_000);
});

describe("fastest-to and best-span lists", () => {
  test("a fastest-to list reads in games, with the game it came in", async () => {
    const { owner } = await setup();
    const lists = await owner.query(api.stats.marks.lists, { statKey: "passYds", horizon: "season" });
    const first = lists.find((l) => l.mark === 1000)?.entries[0];
    expect(first).toMatchObject({ rank: 1, player: { name: "Drake Maye" }, year: SAMPLE_START_YEAR });
    expect(first?.gamesToReach).toBeGreaterThan(0);
    expect(lists.every((l) => l.entries.length > 0)).toBe(true);
  });

  test("a best-span list has one list per window, ranked with both ends", async () => {
    const { owner, player } = await setup();
    const lists = await owner.query(api.stats.spans.lists, { split: "regular", statKey: "passTd" });
    const five = lists.find((l) => l.window === 5)?.entries[0];
    expect(five).toMatchObject({ rank: 1, player: { name: "Drake Maye" }, crossesSeasons: false });
    expect(five?.span).toMatch(/^\d{4} W\d+ to \d{4} W\d+$/);

    const maye = await player("Drake Maye");
    const places = await owner.query(api.stats.spans.forPlayer, { playerId: maye._id });
    expect(places.find((p) => p.statKey === "passTd" && p.window === 5)).toMatchObject({ rank: 1 });
  });
});

describe("streaks", () => {
  test("running streaks drop a player who has left, with the date each began", async () => {
    const { t, owner, player, season, userTeam } = await setup();
    const running = await owner.query(api.stats.streaks.running, {});
    const line = running.players.find((s) => s.player.name === "Drake Maye");
    expect(line?.since).toMatch(/^\d{4} /);

    const maye = await player("Drake Maye");
    await t.run(async (ctx) => {
      const entries = await ctx.db
        .query("rosterEntries")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id).eq("teamId", userTeam._id))
        .take(300);
      for (const e of entries) {
        if (e.playerId === maye._id) await ctx.db.patch("rosterEntries", e._id, { status: "released" });
      }
    });
    const after = await owner.query(api.stats.streaks.running, {});
    expect(after.players.some((s) => s.player.name === "Drake Maye")).toBe(false);
    const { players } = await owner.query(api.stats.streaks.longest, {});
    const passing = players.find((l) => l.key === "passTdGames")?.entries ?? [];
    expect(passing.find((e) => e.player.name === "Drake Maye")).toMatchObject({ longest: 5 });
  });

  test("the season filter works its runs out from that season's games", async () => {
    const { owner, season } = await setup();
    const inSeason = await owner.query(api.stats.streaks.longest, { seasonId: season._id });
    const passing = inSeason.players.find((l) => l.key === "passTdGames")?.entries ?? [];
    expect(passing[0]).toMatchObject({ rank: 1, longest: 5, player: { name: "Drake Maye" } });
    expect(passing[0]?.span).toMatch(/ to /);
    expect(inSeason.team.find((r) => r.key === "wins")).toMatchObject({ longest: 2 });
  });

  test("a season with no games has no lists", async () => {
    const { owner, season, t } = await setup();
    const empty = await t.run((ctx) =>
      ctx.db.insert("seasons", {
        ...season,
        _id: undefined,
        _creationTime: undefined,
        year: season.year + 40,
        teamTotals: undefined,
      } as never),
    );
    const none = await owner.query(api.stats.streaks.longest, { seasonId: empty });
    expect(none).toEqual({ team: [], players: [] });
  });
});

describe("a player's milestones", () => {
  test("list marks and the feed's events together, newest first, with no name on them", async () => {
    const { owner, player } = await setup();
    const maye = await player("Drake Maye");
    const items = await owner.query(api.stats.milestones.forPlayer, { playerId: maye._id });
    const mark = items.find((i) => i.kind === "mark" && i.title === "1,000 passing yards");
    expect(mark?.detail).toContain("#1 fastest");
    expect(items.some((i) => i.kind === "threshold_game")).toBe(true);
    expect(items.every((i) => !i.title.startsWith("Drake Maye"))).toBe(true);
    const years = items.map((i) => i.year);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
  });
});

describe("league leaders", () => {
  test("marks the user's players and says where the team ranks", async () => {
    const { t, owner, franchise, userTeam, season, player } = await setup();
    const maye = await player("Drake Maye");
    const other = await t.run((ctx) =>
      ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", "MIA"))
        .unique(),
    );
    await t.run(async (ctx) => {
      const base = { franchiseId: franchise._id, seasonId: season._id, statKey: "passYds" };
      await ctx.db.insert("leagueLeaders", {
        ...base,
        rank: 1,
        rawName: "Tua Tagovailoa",
        teamId: other!._id,
        value: 4800,
      });
      await ctx.db.insert("leagueLeaders", {
        ...base,
        rank: 2,
        playerId: maye._id,
        teamId: userTeam._id,
        value: 4700,
      });
    });
    const { rows, summary } = await owner.query(api.league.leaders.forSeason, { seasonId: season._id });
    expect(rows.map((r) => [r.name, r.ours])).toEqual([
      ["Tua Tagovailoa", false],
      ["Drake Maye", true],
    ]);
    expect(summary).toMatchObject({ spots: 1, topFive: 1, leaders: 0 });
    expect(summary.best[0]).toMatchObject({ statKey: "passYds", rank: 2, name: "Drake Maye" });
  });
});

describe("authorization", () => {
  test("strangers are refused", async () => {
    const { t, season } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.stats.streaks.running, {})).rejects.toThrow();
    await expect(stranger.query(api.stats.streaks.longest, {})).rejects.toThrow();
    await expect(
      stranger.query(api.stats.marks.lists, { statKey: "passYds", horizon: "season" }),
    ).rejects.toThrow();
    await expect(
      stranger.query(api.stats.spans.lists, { split: "regular", statKey: "passYds" }),
    ).rejects.toThrow();
    await expect(stranger.query(api.league.leaders.forSeason, { seasonId: season._id })).rejects.toThrow();
  });
});
