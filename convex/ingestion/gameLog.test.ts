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
  const image = () =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })));
  /** Uploads and extracts one set; the scheduled extraction runs to completion. */
  const capture = async (args: {
    targetKey?: "game_box_score" | "team_game_stats" | "game_log";
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

describe("full game logs and remembered players", () => {
  test("a combined upload commits both stats, recomputes totals, and replaces them on reimport", async () => {
    const { t, owner, season, capture } = await setup();
    const seasonId = season(SAMPLE_START_YEAR + 1);
    const setKey = await capture({ targetKey: "game_log", seasonId, weekKey: "w1" });
    const review = await owner.query(api.ingestion.review.get, { setKey });
    expect(review.images).toHaveLength(2);
    const draft = review.extraction!.draft;
    if (draft.target !== "game_log") throw new Error("wrong target");
    expect(draft.lines.length).toBeGreaterThan(0);
    expect(draft.teams).toHaveLength(2);
    draft.teams[0]!.stats.passYds = 300;
    draft.teams[0]!.stats.totalYds = 999;
    const { gameId } = await owner.mutation(api.ingestion.review.commit, { setKey, draft });
    const box = await owner.query(api.games.boxScore.get, { gameId: gameId! });
    expect(box.teams[0]!.stats).toMatchObject({ totalYds: 428, passYds: 300, rushYds: 128 });
    expect(box.teams[0]!.lines.length).toBeGreaterThan(0);
    const stored = await t.run((ctx) =>
      ctx.db
        .query("gameTeamStats")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId!))
        .take(2),
    );
    expect(stored.find((r) => r.stats.passYds === 300)?.stats.totalYds).toBe(428);
    const again = await capture({ targetKey: "game_log", seasonId, weekKey: "w1" });
    const next = await owner.query(api.ingestion.review.get, { setKey: again });
    expect(next.game).toMatchObject({ hasBoxScore: true, hasTeamStats: true });
    expect(
      (await owner.mutation(api.ingestion.review.commit, { setKey: again, draft: next.extraction!.draft }))
        .gameId,
    ).toBe(gameId);
    const replaced = await owner.query(api.games.boxScore.get, { gameId: gameId! });
    expect(replaced.teams[0]!.stats?.totalYds).toBe(412);
    expect(replaced.teams[0]!.lines).toHaveLength(box.teams[0]!.lines.length);
  });

  test("player assignments persist from review before commit, override fuzzy matches, and can change", async () => {
    const { t, owner, season, capture } = await setup();
    const seasonId = season(SAMPLE_START_YEAR + 1);
    const setKey = await capture({ targetKey: "game_log", seasonId, weekKey: "w1" });
    const draft = (await owner.query(api.ingestion.review.get, { setKey })).extraction!.draft;
    if (draft.target !== "game_log") throw new Error("wrong target");
    const maye = draft.lines.find((l) => l.name === "D. Maye")!;
    const original = maye.playerId!;
    const alternative = draft.lines.find((l) => l.name === "S. Diggs")!.playerId!;
    // Even a name that would normally resolve to another player obeys the explicit choice.
    maye.playerId = alternative;
    await owner.mutation(api.ingestion.review.saveDraft, { setKey, draft });
    const rerun = await capture({ targetKey: "game_box_score", seasonId, weekKey: "w1" });
    const resolved = (await owner.query(api.ingestion.review.get, { setKey: rerun })).extraction!.draft;
    if (resolved.target !== "game_box_score") throw new Error("wrong target");
    expect(resolved.lines.find((l) => l.name === "D. Maye")).toMatchObject({
      playerId: alternative,
      match: { status: "matched" },
    });
    const names = [
      { name: "D Maye", teamAbbr: "NE" },
      { name: "D. Maye", teamAbbr: "MIA" },
    ];
    expect(await t.query(internal.ingestion.candidates.assignments, { seasonId, names })).toEqual([
      { normalizedName: "d maye", teamAbbr: "NE", playerId: alternative, name: "Stefon Diggs" },
    ]);
    expect(
      await t.query(internal.ingestion.candidates.assignments, {
        seasonId: season(SAMPLE_START_YEAR),
        names,
      }),
    ).toEqual([]);
    maye.playerId = original;
    await owner.mutation(api.ingestion.review.saveDraft, { setKey, draft });
    expect((await t.query(internal.ingestion.candidates.assignments, { seasonId, names }))[0]?.playerId).toBe(
      original,
    );
    await expect(
      (await asStranger(t)).mutation(api.ingestion.review.saveDraft, { setKey, draft }),
    ).rejects.toThrow(/Not the owner/);
  });

  test("new players are remembered when committed and older team totals display as offensive yards", async () => {
    const { t, owner, season, capture } = await setup();
    const seasonId = season(SAMPLE_START_YEAR + 1);
    const setKey = await capture({ targetKey: "game_log", seasonId, weekKey: "w1" });
    const draft = (await owner.query(api.ingestion.review.get, { setKey })).extraction!.draft;
    if (draft.target !== "game_log") throw new Error("wrong target");
    const line = draft.lines[0]!;
    line.name = "X. Unlisted";
    line.playerId = null;
    line.match = { status: "new", candidates: [] };
    const { gameId } = await owner.mutation(api.ingestion.review.commit, { setKey, draft });
    const saved = await t.query(internal.ingestion.candidates.assignments, {
      seasonId,
      names: [{ name: line.name, teamAbbr: line.teamAbbr }],
    });
    expect(saved[0]).toMatchObject({ name: "X. Unlisted" });
    await t.run(async (ctx) => {
      const row = (await ctx.db
        .query("gameTeamStats")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId!))
        .first())!;
      await ctx.db.patch("gameTeamStats", row._id, { stats: { passYds: 284, rushYds: 128, totalYds: 650 } });
    });
    const box = await owner.query(api.games.boxScore.get, { gameId: gameId! });
    expect(box.teams.some((team) => team.stats?.totalYds === 650)).toBe(false);
    expect(box.teams.some((team) => team.stats?.totalYds === 412)).toBe(true);
  });
});

describe("a full game log with its scoring summary", () => {
  const plays = (t: Awaited<ReturnType<typeof setup>>["t"], gameId: Id<"games">) =>
    t.run((ctx) =>
      ctx.db
        .query("scoringPlays")
        .withIndex("by_gameId_and_order", (q) => q.eq("gameId", gameId))
        .take(50),
    );

  test("one upload commits the stats and the plays, and the quarters follow the plays", async () => {
    const { t, owner, season, capture } = await setup();
    const setKey = await capture({
      targetKey: "game_log",
      seasonId: season(SAMPLE_START_YEAR + 1),
      weekKey: "w1",
    });
    const draft = (await owner.query(api.ingestion.review.get, { setKey })).extraction!.draft;
    if (draft.target !== "game_log") throw new Error("wrong target");
    expect(draft.plays?.length).toBeGreaterThan(0);
    const { gameId } = await owner.mutation(api.ingestion.review.commit, { setKey, draft });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const rows = await plays(t, gameId!);
    expect(rows).toHaveLength(draft.plays!.length);
    const last = rows.at(-1)!;
    expect([last.homeScore, last.awayScore]).toEqual([31, 17]);
    const page = await owner.query(api.games.schedule.get, { gameId: gameId! });
    expect(page?.header.quartersFromPlays).toBe(true);
    const box = await owner.query(api.games.boxScore.get, { gameId: gameId! });
    expect(box.teams[0]!.lines.length).toBeGreaterThan(0);
  });

  test("a scorer the box score adds as a new player lands on the play", async () => {
    const { t, owner, season, capture } = await setup();
    const setKey = await capture({
      targetKey: "game_log",
      seasonId: season(SAMPLE_START_YEAR + 1),
      weekKey: "w1",
    });
    const draft = (await owner.query(api.ingestion.review.get, { setKey })).extraction!.draft;
    if (draft.target !== "game_log") throw new Error("wrong target");
    const named = draft.plays!.find((p) => p.name && p.teamAbbr === draft.lines[0]!.teamAbbr)!;
    const edited = {
      ...draft,
      lines: draft.lines.map((l, i) =>
        i === 0
          ? { ...l, name: "Brand Newguy", playerId: null, match: { status: "new" as const, candidates: [] } }
          : l,
      ),
      plays: draft.plays!.map((p) =>
        p.id === named.id ? { ...p, name: "Brand Newguy", playerId: null } : p,
      ),
    };
    const { gameId } = await owner.mutation(api.ingestion.review.commit, { setKey, draft: edited });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const play = (await plays(t, gameId!)).find((p) => p.rawName === "Brand Newguy");
    const player = await t.run((ctx) => ctx.db.get("players", play!.playerId!));
    expect(player?.displayName).toBe("Brand Newguy");
  });

  test("leaving every play out commits the rest and keeps the plays the game had", async () => {
    const { t, owner, season, capture } = await setup();
    const seasonId = season(SAMPLE_START_YEAR + 1);
    const first = await capture({ targetKey: "game_log", seasonId, weekKey: "w1" });
    const draft = (await owner.query(api.ingestion.review.get, { setKey: first })).extraction!.draft;
    const { gameId } = await owner.mutation(api.ingestion.review.commit, { setKey: first, draft });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const before = await plays(t, gameId!);

    const again = await capture({ targetKey: "game_log", gameId: gameId! });
    const second = (await owner.query(api.ingestion.review.get, { setKey: again })).extraction!.draft;
    if (second.target !== "game_log") throw new Error("wrong target");
    const none = { ...second, plays: second.plays!.map((p) => ({ ...p, accepted: false })) };
    await owner.mutation(api.ingestion.review.commit, { setKey: again, draft: none });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await plays(t, gameId!)).map((p) => p.order)).toEqual(before.map((p) => p.order));
  });

  test("plays that miss the log's final block the commit until they are fixed or left out", async () => {
    const { owner, season, capture } = await setup();
    const setKey = await capture({
      targetKey: "game_log",
      seasonId: season(SAMPLE_START_YEAR + 1),
      weekKey: "w1",
    });
    const draft = (await owner.query(api.ingestion.review.get, { setKey })).extraction!.draft;
    if (draft.target !== "game_log") throw new Error("wrong target");
    const short = { ...draft, plays: draft.plays!.slice(0, -1) };
    await expect(owner.mutation(api.ingestion.review.commit, { setKey, draft: short })).rejects.toThrow(
      "the game's final is",
    );
  });

  test("a stored draft from before plays were part of a log still commits", async () => {
    const { owner, season, capture } = await setup();
    const setKey = await capture({
      targetKey: "game_log",
      seasonId: season(SAMPLE_START_YEAR + 1),
      weekKey: "w1",
    });
    const draft = (await owner.query(api.ingestion.review.get, { setKey })).extraction!.draft;
    if (draft.target !== "game_log") throw new Error("wrong target");
    const { plays: _plays, ...older } = draft;
    const { gameId } = await owner.mutation(api.ingestion.review.commit, { setKey, draft: older });
    expect(gameId).toBeDefined();
  });
});
