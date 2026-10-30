/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const finish = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  await finish();
  const game = await t.run(async (ctx) => {
    const first = await ctx.db
      .query("games")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", "w1"))
      .first();
    return first!;
  });
  const plays = () =>
    t.run((ctx) =>
      ctx.db
        .query("scoringPlays")
        .withIndex("by_gameId_and_order", (q) => q.eq("gameId", game._id))
        .take(50),
    );
  /** Reads a scoring summary for the week 1 win with the canned answer and commits it. */
  const commit = async () => {
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })),
    );
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [storageId],
      source: "web",
      targetKey: "scoring_plays",
      gameId: game._id,
    });
    await finish();
    const review = await owner.query(api.ingestion.review.get, { setKey: setKey! });
    await owner.mutation(api.ingestion.review.commit, { setKey: setKey!, draft: review.extraction!.draft });
    await finish();
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
  return { owner, game, plays, commit, player, finish };
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

describe("scoring records and milestones", () => {
  test("a win names its game-winner on the feed, once, and fills the records", async () => {
    const { owner, game, plays, commit, player, finish } = await setup();
    await commit();
    const rows = await plays();
    const diggs = await player("Stefon Diggs");
    for (const play of rows.filter((p) => p.teamId === game.homeTeamId && !p.playerId)) {
      await owner.mutation(api.games.scoring.assign, {
        playId: play._id,
        role: "scorer",
        playerId: diggs._id,
      });
    }
    await finish();
    const feed = await owner.query(api.stats.milestones.feed, {});
    const winners = feed.filter((m) => m.kind === "game_winner");
    expect(winners).toHaveLength(1);
    expect(winners[0]?.gameId).toBe(game._id);
    const lists = await owner.query(api.stats.scoring.records, { split: "regular" });
    expect(lists.map((l) => l.list)).toEqual(
      expect.arrayContaining(["longest_pass_td", "game_winners_season", "team_points_quarter"]),
    );
  });

  test("a game-winner that changes hands moves its milestone", async () => {
    const { owner, game, commit, player, finish } = await setup();
    await commit();
    const { gameWinnerId } = await owner.query(api.games.scoring.byGame, { gameId: game._id });
    const [diggs, henderson] = [await player("Stefon Diggs"), await player("TreVeyon Henderson")];
    for (const { _id: playerId } of [diggs, henderson]) {
      await owner.mutation(api.games.scoring.assign, { playId: gameWinnerId!, role: "scorer", playerId });
      await finish();
    }
    const feed = await owner.query(api.stats.milestones.feed, {});
    expect(feed.filter((m) => m.kind === "game_winner").map((m) => m.playerId)).toEqual([henderson._id]);
  });
});
