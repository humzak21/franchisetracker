/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

const DERIVED = ["playerMarks", "spanBoards", "teamRecords", "streaks"] as const;

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const finish = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  await finish();
  const gameIn = (weekKey: "w1" | "w2" | "w6") =>
    t.run(async (ctx) => {
      const game = await ctx.db
        .query("games")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
        .first();
      return game!;
    });
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
  const marks = (playerId: Id<"players">) =>
    t.run((ctx) =>
      ctx.db
        .query("playerMarks")
        .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
        .take(100),
    );
  const spanBoard = (statKey: string, window: number) =>
    t.run((ctx) =>
      ctx.db
        .query("spanBoards")
        .withIndex("by_franchiseId_and_split_and_statKey_and_window", (q) =>
          q
            .eq("franchiseId", active.franchise._id)
            .eq("split", "regular")
            .eq("statKey", statKey)
            .eq("window", window),
        )
        .unique(),
    );
  const teamBoard = (statKey: string, scope: "game" | "season") =>
    t.run((ctx) =>
      ctx.db
        .query("teamRecords")
        .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) =>
          q
            .eq("franchiseId", active.franchise._id)
            .eq("split", "regular")
            .eq("scope", scope)
            .eq("statKey", statKey),
        )
        .unique(),
    );
  /** Everything derived, without ids, in a stable order: what two ways of building must agree on. */
  const derived = () =>
    t.run(async (ctx) => {
      const out: Record<string, string[]> = {};
      for (const table of DERIVED) {
        const rows = await ctx.db.query(table).take(5000);
        out[table] = rows
          .map(({ _id: _i, _creationTime: _c, ...row }) => JSON.stringify(row, Object.keys(row).sort()))
          .sort();
      }
      return out;
    });
  /** Every row as stored, ids included: unchanged only if nothing was rewritten. */
  const stored = () =>
    t.run(async (ctx) => {
      const out: Record<string, unknown[]> = {};
      for (const table of DERIVED) out[table] = await ctx.db.query(table).take(5000);
      return out;
    });
  const setRushing = async (gameId: Id<"games">, playerId: Id<"players">, value: number) => {
    await owner.mutation(api.games.statLines.setStat, { gameId, playerId, statKey: "rushYds", value });
    await finish();
  };
  return {
    t,
    owner,
    seasonId,
    finish,
    gameIn,
    player,
    marks,
    spanBoard,
    teamBoard,
    derived,
    stored,
    setRushing,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("a game", () => {
  test("sets a season mark, with the game and how many it took", async () => {
    const { gameIn, player, marks, setRushing, owner } = await setup();
    const game = await gameIn("w2");
    const henderson = await player("TreVeyon Henderson");
    await setRushing(game._id, henderson._id, 1000);

    // The season counts from week 1; his career counts his real seasons too, so it has its own game.
    const season = (await marks(henderson._id)).filter(
      (m) => m.statKey === "rushYds" && m.mark === 1000 && m.horizon === "season",
    );
    expect(season).toHaveLength(1);
    expect(season[0]).toMatchObject({ gameId: game._id, gamesToReach: 2, weekKey: "w2" });

    const feed = await owner.query(api.stats.milestones.feed, {});
    const raised = feed.filter(
      (m) => m.kind === "mark" && m.playerId === henderson._id && m.gameId === game._id,
    );
    expect(raised.length).toBeGreaterThan(0);
  });

  test("improves a span, naming both ends", async () => {
    const { gameIn, player, spanBoard, setRushing } = await setup();
    const game = await gameIn("w2");
    const henderson = await player("TreVeyon Henderson");
    await setRushing(game._id, henderson._id, 300);
    const top = (await spanBoard("rushYds", 2))?.top[0];
    expect(top).toMatchObject({ playerId: henderson._id, crossesSeasons: false });
    // The sample's week 1 is 88 yards and week 3 is 97.
    expect(top?.value).toBe(397);
    expect(top?.endGameId).not.toBe(top?.startGameId);
  });

  test("dates a streak, from where it began to where it stands", async () => {
    const { t, seasonId, player, finish } = await setup();
    const maye = await player("Drake Maye");
    await finish();
    const rows = await t.run((ctx) =>
      ctx.db
        .query("streaks")
        .withIndex("by_playerId", (q) => q.eq("playerId", maye._id))
        .take(20),
    );
    const games = rows.find((r) => r.key === "appearances");
    expect(games?.current).toBeGreaterThan(1);
    expect(games?.currentFrom).toMatchObject({ seasonId, weekKey: "w1" });
    expect(games?.longestTo?.weekKey).toBe("w6");
  });

  test("sets a team record and raises it once", async () => {
    const { owner, gameIn, teamBoard, finish } = await setup();
    const game = await gameIn("w1");
    await owner.mutation(api.games.manage.update, {
      gameId: game._id,
      weekKey: game.weekKey,
      bye: false,
      opponentTeamId: game.opponentTeamId,
      userIsHome: game.userIsHome,
      us: 70,
      them: 3,
      overtime: false,
    });
    await finish();
    expect((await teamBoard("pointsFor", "game"))?.top[0]).toMatchObject({ value: 70, gameId: game._id });
    expect((await teamBoard("biggestWin", "game"))?.top[0]?.value).toBe(67);
    const feed = await owner.query(api.stats.milestones.feed, {});
    expect(feed.filter((m) => m.kind === "team_record").map((m) => m.title)).toContain(
      "Team record: most points, 70",
    );
  });
});

describe("recommitting", () => {
  test("rewrites nothing", async () => {
    const { owner, gameIn, player, setRushing, stored, finish } = await setup();
    const game = await gameIn("w2");
    const henderson = await player("TreVeyon Henderson");
    await setRushing(game._id, henderson._id, 1000);
    const before = await stored();
    const feed = await owner.query(api.stats.milestones.feed, {});
    await setRushing(game._id, henderson._id, 1000);
    await finish();
    expect(await stored()).toEqual(before);
    expect(await owner.query(api.stats.milestones.feed, {})).toEqual(feed);
  });
});

describe("a correction", () => {
  test("un-reaches a mark and lowers a span", async () => {
    const { gameIn, player, marks, spanBoard, setRushing, owner } = await setup();
    const game = await gameIn("w2");
    const henderson = await player("TreVeyon Henderson");
    const titles = async () => {
      const feed = await owner.query(api.stats.milestones.feed, {});
      return feed
        .filter((m) => m.kind === "mark" && m.gameId === game._id && m.playerId === henderson._id)
        .map((m) => m.title)
        .sort();
    };
    // His real seasons can put a career mark in this game already; the correction must restore that.
    const before = await titles();
    await setRushing(game._id, henderson._id, 1000);
    const during = await titles();
    await setRushing(game._id, henderson._id, 64);
    const left = await marks(henderson._id);
    expect(left.filter((m) => m.statKey === "rushYds" && m.horizon === "season")).toEqual([]);
    expect((await spanBoard("rushYds", 2))?.top[0]?.value).toBeLessThan(1000);
    expect(during).not.toEqual(before);
    expect(await titles()).toEqual(before);
  });

  test("a deleted game takes its mark, span and team entries with it", async () => {
    const { owner, gameIn, player, marks, spanBoard, teamBoard, setRushing, finish } = await setup();
    const game = await gameIn("w2");
    const henderson = await player("TreVeyon Henderson");
    await setRushing(game._id, henderson._id, 1000);
    await owner.mutation(api.games.manage.remove, { gameId: game._id });
    await finish();
    expect((await marks(henderson._id)).filter((m) => m.gameId === game._id)).toEqual([]);
    const board = await spanBoard("rushYds", 2);
    expect(board?.top.some((e) => e.startGameId === game._id || e.endGameId === game._id)).toBe(false);
    const list = await teamBoard("pointsFor", "game");
    expect(list?.top.some((e) => e.gameId === game._id)).toBe(false);
  });
});

describe("a rebuild from scratch", () => {
  test("matches what the games built one at a time", async () => {
    const { t, owner, gameIn, player, setRushing, derived, finish } = await setup();
    const game = await gameIn("w2");
    const [henderson, maye] = [await player("TreVeyon Henderson"), await player("Drake Maye")];
    await setRushing(game._id, henderson._id, 1000);
    await setRushing((await gameIn("w6"))._id, maye._id, 700);
    await owner.mutation(api.games.manage.update, {
      gameId: game._id,
      weekKey: game.weekKey,
      bye: false,
      opponentTeamId: game.opponentTeamId,
      userIsHome: game.userIsHome,
      us: 45,
      them: 24,
      overtime: false,
    });
    await finish();
    const incremental = await derived();
    expect(incremental.playerMarks!.length).toBeGreaterThan(0);
    expect(incremental.spanBoards!.length).toBeGreaterThan(0);
    expect(incremental.teamRecords!.length).toBeGreaterThan(0);

    await t.mutation(internal.stats.rebuild.all, {});
    await finish();
    expect(await derived()).toEqual(incremental);
  }, 180_000);

  test("starts from Settings and reports while it runs", async () => {
    const { t, owner, finish } = await setup();
    await owner.mutation(api.stats.rebuild.start, {});
    expect(await owner.query(api.stats.recordBuild.status, {})).toMatchObject({ status: "running" });
    await finish();
    expect(await owner.query(api.stats.recordBuild.status, {})).toMatchObject({ status: "done" });
    await expect((await asStranger(t)).mutation(api.stats.rebuild.start, {})).rejects.toThrow();
  }, 180_000);
});

describe("what moved", () => {
  test("old scoring boards for the team lists are dropped, not shown", async () => {
    const { t, owner, gameIn, finish } = await setup();
    const game = await gameIn("w1");
    await t.run(async (ctx) => {
      await ctx.db.insert("scoringBoards", {
        franchiseId: game.franchiseId,
        split: "regular",
        list: "team_comeback",
        top: [{ value: 10, seasonId: game.seasonId, year: SAMPLE_START_YEAR }],
      });
    });
    const lists = await owner.query(api.stats.scoring.records, { split: "regular" });
    expect(lists.map((l) => l.list)).not.toContain("team_comeback");
    await t.mutation(internal.stats.scoring.boards, { franchiseId: game.franchiseId });
    await finish();
    const left = await t.run((ctx) => ctx.db.query("scoringBoards").take(50));
    expect(left.map((b) => b.list)).not.toContain("team_comeback");
  });

  test("the team's lists read in registry order, best first", async () => {
    const { owner } = await setup();
    const lists = await owner.query(api.stats.teamRecords.lists, { split: "regular", scope: "game" });
    expect(lists[0]?.statKey).toBe("pointsFor");
    const points = lists[0]!.entries.map((e) => e.value);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });
});
