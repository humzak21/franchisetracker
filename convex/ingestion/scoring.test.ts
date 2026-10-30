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
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const finish = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  await finish();
  const image = () =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })));
  const gameIn = (weekKey: "w1" | "w2" | "w6") =>
    t.run(async (ctx) => {
      const game = await ctx.db
        .query("games")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
        .first();
      return game!;
    });
  const plays = (gameId: Id<"games">) =>
    t.run((ctx) =>
      ctx.db
        .query("scoringPlays")
        .withIndex("by_gameId_and_order", (q) => q.eq("gameId", gameId))
        .take(50),
    );
  /** Uploads a scoring summary for a game and reads it with the canned answer. */
  const read = async (gameId: Id<"games">) => {
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [await image(), await image()],
      source: "web",
      targetKey: "scoring_plays",
      gameId,
    });
    await finish();
    const review = await owner.query(api.ingestion.review.get, { setKey: setKey! });
    const draft = review.extraction!.draft;
    if (!("rows" in draft)) throw new Error("not a row draft");
    return { setKey: setKey!, draft };
  };
  /** Reads and commits in one go. */
  const commit = async (gameId: Id<"games">) => {
    const { setKey, draft } = await read(gameId);
    const result = await owner.mutation(api.ingestion.review.commit, { setKey, draft });
    await finish();
    return result;
  };
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
  return {
    t,
    owner,
    seasonId,
    finish,
    image,
    gameIn,
    plays,
    read,
    commit,
    player,
    franchise: active.franchise,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("committing a scoring summary", () => {
  test("from photos to plays: the quarters fill in and the game goes to its page", async () => {
    const { t, gameIn, plays, commit } = await setup();
    const game = await gameIn("w1");
    await t.run((ctx) => ctx.db.patch("games", game._id, { lineScore: undefined }));
    const result = await commit(game._id);
    expect(result.gameId).toBe(game._id);
    const rows = await plays(game._id);
    expect(rows.map((r) => r.order)).toEqual(rows.map((_, i) => i + 1));
    const last = rows.at(-1)!;
    expect([last.homeScore, last.awayScore]).toEqual([game.homeScore, game.awayScore]);
    const after = await gameIn("w1");
    const sum = (line: readonly number[]) => line.reduce((a, b) => a + b, 0);
    expect(sum(after.lineScore!.home)).toBe(game.homeScore);
    expect(sum(after.lineScore!.away)).toBe(game.awayScore);
  });

  test("the row whose name the screen dropped commits with no scorer", async () => {
    const { gameIn, plays, commit } = await setup();
    const game = await gameIn("w1");
    await commit(game._id);
    const nameless = (await plays(game._id)).filter((p) => !p.rawName);
    expect(nameless).toHaveLength(1);
    expect(nameless[0]).toMatchObject({ kind: "pass_td" });
    expect(nameless[0]!.playerId).toBeUndefined();
  });

  test("a name that matches no one stays as printed and creates no player", async () => {
    const { t, gameIn, plays, commit, franchise } = await setup();
    const game = await gameIn("w1");
    const count = async () => {
      const all = await t.run((ctx) =>
        ctx.db
          .query("players")
          .withIndex("by_franchiseId_and_lastName", (q) => q.eq("franchiseId", franchise._id))
          .take(500),
      );
      return all.length;
    };
    const before = await count();
    await commit(game._id);
    expect(await count()).toBe(before);
    const stranger = (await plays(game._id)).find((p) => p.rawName === "R. Stevenson");
    expect(stranger?.playerId).toBeUndefined();
  });

  test("committing again rewrites the set and keeps a player assigned on the game page", async () => {
    const { owner, gameIn, plays, commit, player, finish } = await setup();
    const game = await gameIn("w1");
    await commit(game._id);
    const first = await plays(game._id);
    const nameless = first.find((p) => !p.rawName)!;
    const diggs = await player("Stefon Diggs");
    await owner.mutation(api.games.scoring.assign, {
      playId: nameless._id,
      role: "scorer",
      playerId: diggs._id,
    });
    await finish();
    await commit(game._id);
    const second = await plays(game._id);
    expect(second).toHaveLength(first.length);
    expect(second.find((p) => p.period === nameless.period && p.clock === nameless.clock)?.playerId).toBe(
      diggs._id,
    );
    const feed = await owner.query(api.stats.milestones.feed, {});
    const scoring = feed.filter((m) => m.kind === "game_winner" || m.kind === "first_td");
    expect(new Set(scoring.map((m) => m.title)).size).toBe(scoring.length);
  });

  test("plays that do not reach the final are refused and nothing is written", async () => {
    const { owner, gameIn, plays, read } = await setup();
    const game = await gameIn("w1");
    const { setKey, draft } = await read(game._id);
    const short = { ...draft, rows: draft.rows.slice(0, -1) };
    await expect(owner.mutation(api.ingestion.review.commit, { setKey, draft: short })).rejects.toThrow(
      "the game's final is",
    );
    expect(await plays(game._id)).toEqual([]);
  });

  test("a game with no final takes its score from the last play", async () => {
    const { t, gameIn, commit } = await setup();
    const game = await gameIn("w1");
    await t.run((ctx) =>
      ctx.db.patch("games", game._id, {
        homeScore: undefined,
        awayScore: undefined,
        result: undefined,
        status: "scheduled",
      }),
    );
    await commit(game._id);
    const after = await gameIn("w1");
    expect(after).toMatchObject({ status: "played", homeScore: 31, awayScore: 17, result: "W" });
  });

  test("a week with no game refuses the commit", async () => {
    const { owner, seasonId, image, finish } = await setup();
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [await image()],
      source: "web",
      targetKey: "scoring_plays",
      seasonId,
      weekKey: "w12",
    });
    await finish();
    const review = await owner.query(api.ingestion.review.get, { setKey: setKey! });
    await expect(
      owner.mutation(api.ingestion.review.commit, { setKey: setKey!, draft: review.extraction!.draft }),
    ).rejects.toThrow("no game");
  });
});

describe("the game page", () => {
  test("says who won it, and the quarters are no longer typed", async () => {
    const { owner, gameIn, commit } = await setup();
    const game = await gameIn("w1");
    await commit(game._id);
    const data = await owner.query(api.games.scoring.byGame, { gameId: game._id });
    expect(data.gameWinnerId).not.toBeNull();
    expect(data.context?.homeScore).toBe(game.homeScore);
    const page = await owner.query(api.games.schedule.get, { gameId: game._id });
    expect(page?.header.quartersFromPlays).toBe(true);
    await expect(
      owner.mutation(api.games.schedule.setLineScore, { gameId: game._id, lineScore: null }),
    ).rejects.toThrow("scoring plays");
  });

  test("assigning a play remembers how the screen printed the name", async () => {
    const { t, owner, gameIn, plays, commit, player, franchise, seasonId } = await setup();
    const game = await gameIn("w1");
    await commit(game._id);
    const printed = (await plays(game._id)).find((p) => p.rawName === "R. Stevenson")!;
    const henderson = await player("TreVeyon Henderson");
    await owner.mutation(api.games.scoring.assign, {
      playId: printed._id,
      role: "scorer",
      playerId: henderson._id,
    });
    const saved = await t.run((ctx) =>
      ctx.db
        .query("playerNameAssignments")
        .withIndex("by_franchiseId_and_seasonId_and_teamAbbr_and_normalizedName", (q) =>
          q.eq("franchiseId", franchise._id).eq("seasonId", seasonId),
        )
        .take(50),
    );
    expect(saved.map((s) => s.playerId)).toContain(henderson._id);
  });

  test("a stranger can neither read plays nor assign them", async () => {
    const { t, gameIn, plays, commit, player } = await setup();
    const game = await gameIn("w1");
    await commit(game._id);
    const stranger = await asStranger(t);
    const [first] = await plays(game._id);
    const diggs = await player("Stefon Diggs");
    await expect(stranger.query(api.games.scoring.byGame, { gameId: game._id })).rejects.toThrow();
    await expect(
      stranger.mutation(api.games.scoring.assign, {
        playId: first!._id,
        role: "scorer",
        playerId: diggs._id,
      }),
    ).rejects.toThrow();
  });

  test("a deleted game takes its plays with it and leaves the records", async () => {
    const { owner, gameIn, plays, commit, finish } = await setup();
    const game = await gameIn("w1");
    await commit(game._id);
    expect((await owner.query(api.stats.scoring.records, { split: "regular" })).length).toBeGreaterThan(0);
    await owner.mutation(api.games.manage.remove, { gameId: game._id });
    await finish();
    expect(await plays(game._id)).toEqual([]);
    expect(await owner.query(api.stats.scoring.records, { split: "regular" })).toEqual([]);
  });

  test("merging a duplicate moves the plays scored and thrown", async () => {
    const { t, owner, gameIn, plays, commit, player } = await setup();
    const game = await gameIn("w1");
    await commit(game._id);
    const diggs = await player("Stefon Diggs");
    const [play] = await plays(game._id);
    const dupe = await t.run(async (ctx) => {
      const id: Id<"players"> = await ctx.db.insert("players", {
        ...diggs,
        _id: undefined,
        _creationTime: undefined,
        displayName: "S. Diggs",
      } as never);
      await ctx.db.patch("scoringPlays", play!._id, { playerId: id, passerId: id });
      return id;
    });
    await owner.mutation(api.players.identity.merge, { sourceId: dupe, targetId: diggs._id });
    const [first] = await plays(game._id);
    expect(first).toMatchObject({ playerId: diggs._id, passerId: diggs._id });
  });
});
