/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { emptyRow } from "../../shared/ingestion/manual";
import { rowTarget } from "../../shared/ingestion/targets";
import { api, internal } from "../_generated/api";
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
  const image = () =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })));
  /** Uploads two shots of week 1's schedule, accepts every row and commits. */
  const commitWeek = async () => {
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [await image(), await image()],
      source: "web",
      targetKey: "league_schedule",
      seasonId,
      weekKey: "w1",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const draft = (await owner.query(api.ingestion.review.get, { setKey: setKey! })).extraction!.draft;
    if (!("rows" in draft)) throw new Error("not a row draft");
    const accepted = { ...draft, rows: draft.rows.map((r) => ({ ...r, accepted: true })) };
    await owner.mutation(api.ingestion.review.commit, { setKey: setKey!, draft: accepted });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return accepted;
  };
  const week = (weekKey: "w1" | "w2") =>
    t.run((ctx) =>
      ctx.db
        .query("leagueGames")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
        .take(40),
    );
  return { t, owner, seasonId, commitWeek, week };
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

describe("league schedule", () => {
  test("a week of scores upserts per matchup and confirms the user's own game", async () => {
    const { t, owner, seasonId, commitWeek, week } = await setup();
    const draft = await commitWeek();
    const first = await week("w1");
    expect(first).toHaveLength(draft.rows.length);
    await commitWeek();
    const second = await week("w1");
    expect(second.map((g) => g._id).sort()).toEqual(first.map((g) => g._id).sort());

    const scores = await owner.query(api.leagueGames.scores.byWeek, { seasonId, weekKey: "w1" });
    expect(scores[0]).toMatchObject({ isUser: true, home: { abbr: "NE" }, homeScore: 31, awayScore: 17 });
    expect(scores.find((g) => g.away.abbr === "SF")).toMatchObject({ home: { abbr: "LAC" }, awayScore: 23 });
    expect(await owner.query(api.leagueGames.scores.weeks, { seasonId })).toEqual(["w1"]);

    const { games } = await owner.query(api.games.schedule.bySeason, { seasonId });
    const userGame = games.find((g) => g.weekKey === "w1")!;
    const stored = await t.run((ctx) => ctx.db.get("games", userGame._id));
    expect(stored).toMatchObject({ status: "played", homeScore: 31, awayScore: 17, result: "W" });
  });

  test("a matchup typed in by hand lands the same way; the header week must match the filed week", async () => {
    const { owner, seasonId, week } = await setup();
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "league_schedule",
      seasonId,
      weekKey: "w2",
    });
    const entry = (await owner.query(api.ingestion.manual.get, { draftId }))!;
    if (!("rows" in entry.draft)) throw new Error("not a row draft");
    const row = emptyRow(rowTarget("league_schedule").spec, entry.draft);
    const values = { ...row.values, awayTeam: "SF", homeTeam: "LAC", awayScore: 23, homeScore: 20 };
    const draft = { ...entry.draft, meta: { week: "w3" }, rows: [{ ...row, values }] };
    await expect(owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft })).rejects.toThrow(
      /shows Week 3/,
    );
    await owner.mutation(api.ingestion.manualCommit.commit, {
      draftId,
      draft: { ...draft, meta: { week: null } },
    });
    expect((await week("w2")).map((g) => [g.awayScore, g.homeScore, g.timeLabel])).toEqual([
      [23, 20, undefined],
    ]);
  });

  test("strangers cannot read league scores", async () => {
    const { t, seasonId } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.leagueGames.scores.byWeek, { seasonId, weekKey: "w1" })).rejects.toThrow(
      /Not the owner/,
    );
    await expect(t.query(api.leagueGames.scores.weeks, { seasonId })).rejects.toThrow(/Sign in required/);
  });
});
