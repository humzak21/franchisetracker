/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";
import { fixtureAnswer } from "./fixture";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const season = (year: number) => active.seasons.find((s) => s.year === year)!._id;
  const image = () =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })));
  /** Uploads and extracts one set; the scheduled extraction runs to completion. */
  const capture = async (args: {
    targetKey?: "game_box_score" | "team_game_stats";
    seasonId?: Id<"seasons">;
    weekKey?: "w1" | "w2";
    gameId?: Id<"games">;
  }) => {
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [await image(), await image()],
      source: "web",
      ...args,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return setKey!;
  };
  return { t, owner, season, capture, image };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.AUTH_TEST_MODE;
});

describe("ingestion", () => {
  test("a box score goes from upload to review to committed game and season totals", async () => {
    const { t, owner, season, capture } = await setup();
    const seasonId = season(SAMPLE_START_YEAR + 1);
    const setKey = await capture({ targetKey: "game_box_score", seasonId, weekKey: "w1" });

    const [inbox] = await owner.query(api.ingestion.inbox.list, {});
    expect(inbox).toMatchObject({ setKey, status: "review", images: [{}, {}] });
    const review = await owner.query(api.ingestion.review.get, { setKey });
    const draft = review.extraction!.draft;
    if (draft.target !== "game_box_score") throw new Error("wrong target");
    const maye = draft.lines.find((l) => l.name === "D. Maye")!;
    expect(maye.match.status).toBe("matched");
    expect(maye.stats).toMatchObject({ passYds: 284, rushYds: 24 });
    expect(review.game).toBeNull();

    maye.stats.passYds = 290;
    const diggs = draft.lines.find((l) => l.name === "S. Diggs")!;
    diggs.stats.recYds = 137;
    const { gameId } = await owner.mutation(api.ingestion.review.commit, { setKey, draft });

    const game = await t.run((ctx) => ctx.db.get("games", gameId));
    expect(game).toMatchObject({
      weekKey: "w1",
      status: "played",
      homeScore: 31,
      awayScore: 17,
      result: "W",
    });
    const box = await owner.query(api.games.boxScore.get, { gameId });
    expect(box.teams.map((s) => [s.team.abbr, s.isUser])).toEqual([
      ["NE", true],
      ["MIA", false],
    ]);
    expect(box.teams[0]!.lines.find((l) => l.name === "Drake Maye")?.stats.passYds).toBe(290);

    const page = await owner.query(api.players.player.get, { playerId: maye.playerId! });
    const logs = page.seasons.find((s) => s.year === SAMPLE_START_YEAR + 1);
    expect(logs?.stats).toMatchObject({ gamesPlayed: 1, split: "regular", totals: { passYds: 290 } });
    const career = await t.run((ctx) =>
      ctx.db
        .query("careerPlayerStats")
        .withIndex("by_playerId", (q) => q.eq("playerId", maye.playerId!))
        .collect(),
    );
    expect(career).toHaveLength(1);

    const corrections = await t.run((ctx) => ctx.db.query("corrections").collect());
    expect(corrections.map((c) => [c.extractedValue, c.correctedValue]).sort()).toEqual([
      [131, 137],
      [284, 290],
    ]);
    const seasonDoc = await t.run((ctx) => ctx.db.get("seasons", seasonId));
    expect(seasonDoc?.userRecord).toMatchObject({ w: 1, l: 0, t: 0 });
    // New opponent players get partial roster entries; nothing is committed twice.
    await expect(owner.mutation(api.ingestion.review.commit, { setKey, draft })).rejects.toThrow(
      /already committed/,
    );
  });

  test("recommitting a game replaces its lines instead of adding to them", async () => {
    const { owner, season, capture } = await setup();
    const seasonId = season(SAMPLE_START_YEAR + 1);
    const commitOnce = async () => {
      const setKey = await capture({ targetKey: "game_box_score", seasonId, weekKey: "w2" });
      const review = await owner.query(api.ingestion.review.get, { setKey });
      return {
        review,
        ...(await owner.mutation(api.ingestion.review.commit, { setKey, draft: review.extraction!.draft })),
      };
    };
    const first = await commitOnce();
    const second = await commitOnce();
    expect(second.gameId).toBe(first.gameId);
    expect(second.review.game).toMatchObject({ _id: first.gameId, hasBoxScore: true });
    const draft = second.review.extraction!.draft;
    if (draft.target !== "game_box_score") throw new Error("wrong target");
    const page = await owner.query(api.players.player.get, { playerId: draft.lines[0]!.playerId! });
    expect(page.seasons.find((s) => s.year === SAMPLE_START_YEAR + 1)?.stats.gamesPlayed).toBe(1);
  });

  test("team stats attach to the game tagged from game detail", async () => {
    const { owner, season, capture } = await setup();
    const { games } = await owner.query(api.games.schedule.bySeason, { seasonId: season(SAMPLE_START_YEAR) });
    const week1 = games.find((g) => g.weekKey === "w1")!;
    const setKey = await capture({ targetKey: "team_game_stats", gameId: week1._id });
    const review = await owner.query(api.ingestion.review.get, { setKey });
    expect(review).toMatchObject({
      weekKey: "w1",
      game: { _id: week1._id, opponentAbbr: "LV", hasTeamStats: false },
    });
    await owner.mutation(api.ingestion.review.commit, { setKey, draft: review.extraction!.draft });
    const box = await owner.query(api.games.boxScore.get, { gameId: week1._id });
    expect(box.teams[0]!.stats).toMatchObject({ totalYds: 412, possessionSec: 32 * 60 + 14 });
  });

  test("errors in the draft block commit", async () => {
    const { owner, season, capture } = await setup();
    const setKey = await capture({
      targetKey: "game_box_score",
      seasonId: season(SAMPLE_START_YEAR + 1),
      weekKey: "w1",
    });
    const draft = (await owner.query(api.ingestion.review.get, { setKey })).extraction!.draft;
    if (draft.target !== "game_box_score") throw new Error("wrong target");
    draft.lines[0]!.stats.passCmp = 99;
    await expect(owner.mutation(api.ingestion.review.commit, { setKey, draft })).rejects.toThrow(/exceed/);
  });

  test("untagged uploads wait in the inbox until tagged", async () => {
    const { owner, season, capture } = await setup();
    // Without a multi-image target, each screenshot is its own set.
    await capture({});
    await capture({});
    const untagged = await owner.query(api.ingestion.inbox.list, {});
    expect(untagged.map((s) => s.status)).toEqual(["queued", "queued", "queued", "queued"]);
    expect(await owner.query(api.ingestion.inbox.pendingCount, {})).toBe(4);
    await owner.mutation(api.ingestion.uploads.tag, {
      setKeys: untagged.map((s) => s.setKey),
      merge: true,
      targetKey: "game_box_score",
      seasonId: season(SAMPLE_START_YEAR + 1),
      weekKey: "w1",
    });
    await vi.runAllTimersAsync();
    const sets = await owner.query(api.ingestion.inbox.list, {});
    expect(sets).toHaveLength(1);
    expect(sets[0]!.images).toHaveLength(4);
  });

  test("without an OpenRouter key outside test mode, extraction fails with a clear error", async () => {
    delete process.env.AUTH_TEST_MODE;
    const { owner, season, capture } = await setup();
    const setKey = await capture({
      targetKey: "game_box_score",
      seasonId: season(SAMPLE_START_YEAR + 1),
      weekKey: "w1",
    });
    expect(await owner.query(api.ingestion.review.get, { setKey })).toMatchObject({
      status: "failed",
      error: expect.stringMatching(/OPENROUTER_API_KEY/),
    });
  });

  test("OpenRouter falls back to the second model when the first fails", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      calls.push(body.model);
      if (calls.length === 1) return Response.json({ error: { message: "overloaded" } }, { status: 503 });
      const answer = fixtureAnswer("game_box_score", { home: "NE", away: "BUF", userIsHome: true });
      return Response.json({
        model: body.model,
        choices: [{ message: { content: JSON.stringify(answer) } }],
        usage: { prompt_tokens: 1000, completion_tokens: 400, total_tokens: 1400 },
      });
    });
    const { owner, season, capture } = await setup();
    const setKey = await capture({
      targetKey: "game_box_score",
      seasonId: season(SAMPLE_START_YEAR + 1),
      weekKey: "w1",
    });
    expect(calls).toEqual(["google/gemini-4-argon", "anthropic/claude-sonnet-5.5"]);
    const review = await owner.query(api.ingestion.review.get, { setKey });
    expect(review.extraction?.model).toBe("anthropic/claude-sonnet-5.5");
  });

  test("strangers and signed-out callers are refused", async () => {
    const { t, image } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.ingestion.inbox.list, {})).rejects.toThrow(/Not the owner/);
    await expect(
      t.mutation(api.ingestion.uploads.create, { storageIds: [await image()], source: "web" }),
    ).rejects.toThrow(/Sign in required/);
  });
});

describe("shortcut endpoint", () => {
  const form = (target?: string) => {
    const body = new FormData();
    body.append("image", new Blob([new Uint8Array(32)], { type: "image/jpeg" }), "box.jpg");
    if (target) body.append("target", target);
    body.append("week", "w1");
    return body;
  };

  test("refuses a missing or revoked token and accepts a valid one", async () => {
    const { t, owner } = await setup();
    expect((await t.fetch("/shortcut/upload", { method: "POST", body: form() })).status).toBe(401);
    const token = await owner.action(api.ingestion.tokens.create, { label: "iPhone" });
    const headers = { Authorization: `Bearer ${token}` };

    const menu = await t.fetch("/shortcut/targets", { headers });
    expect(await menu.json()).toMatchObject({
      season: SAMPLE_START_YEAR,
      suggestedWeek: "Week 7",
      targetLabels: ["Box score", "Team game stats"],
      targetByLabel: { "Box score": "game_box_score" },
      weekByLabel: { "Week 1": "w1" },
    });
    const bad = await t.fetch("/shortcut/upload", { method: "POST", headers, body: form("nonsense") });
    expect(bad.status).toBe(400);
    const ok = await t.fetch("/shortcut/upload", { method: "POST", headers, body: form() });
    expect(await ok.json()).toMatchObject({ ok: true, images: 1 });
    const [set] = await owner.query(api.ingestion.inbox.list, {});
    expect(set).toMatchObject({ status: "queued", weekKey: "w1", year: SAMPLE_START_YEAR });

    const [listed] = await owner.query(api.ingestion.tokens.list, {});
    expect(listed?.lastUsedAt).not.toBeNull();
    await owner.mutation(api.ingestion.tokens.revoke, { tokenId: listed!._id });
    expect((await t.fetch("/shortcut/targets", { headers })).status).toBe(401);
  });
});
