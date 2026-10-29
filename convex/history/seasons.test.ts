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
  const history = async (year: number) => {
    const { seasons } = await owner.query(api.history.trophies.overview, {});
    return seasons.find((s) => s.year === year);
  };
  /** Types one team history row in by hand and commits it. */
  const typeIn = async (values: Record<string, number | string>) => {
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "team_history",
      seasonId,
    });
    const entry = (await owner.query(api.ingestion.manual.get, { draftId }))!;
    if (!("rows" in entry.draft)) throw new Error("not a row draft");
    const row = emptyRow(rowTarget("team_history").spec, entry.draft);
    const draft = { ...entry.draft, rows: [{ ...row, values: { ...row.values, ...values } }] };
    await owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft });
  };
  return { t, owner, active, seasonId, history, typeIn };
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

describe("team history", () => {
  test("a screenshot of the team's history adds its seasons, and again rewrites them", async () => {
    const { t, owner, active, seasonId, history } = await setup();
    const image = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })),
    );
    const commit = async () => {
      const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
        storageIds: [image],
        source: "web",
        targetKey: "team_history",
        seasonId,
      });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const draft = (await owner.query(api.ingestion.review.get, { setKey: setKey! })).extraction!.draft;
      if (!("rows" in draft)) throw new Error("not a row draft");
      const accepted = { ...draft, rows: draft.rows.map((r) => ({ ...r, accepted: true })) };
      await owner.mutation(api.ingestion.review.commit, { setKey: setKey!, draft: accepted });
    };
    await commit();
    await commit();

    const season = (await history(1985))!;
    expect(season).toMatchObject({
      status: "complete",
      userRecord: { w: 11, l: 5, t: 0, divisionRank: 2, seed: 5, playoffResult: "sb_loss" },
      coaching: { headCoach: "Raymond Berry" },
    });
    expect((await history(1986))?.userRecord).toMatchObject({ divisionRank: 1, playoffResult: "div_loss" });
    const standings = await t.run((ctx) =>
      ctx.db
        .query("standings")
        .withIndex("by_seasonId_and_teamId", (q) =>
          q.eq("seasonId", season._id).eq("teamId", active.franchise.userTeamId),
        )
        .collect(),
    );
    expect(standings).toMatchObject([{ w: 11, pointsFor: 362, pointsAgainst: 290 }]);
  });

  test("typed-in seasons are checked, and franchise seasons are refused", async () => {
    const { typeIn, history } = await setup();
    await typeIn({ year: 1976, w: 11, l: 3, t: 0, playoffResult: "div_loss", headCoach: "Chuck Fairbanks" });
    expect((await history(1976))?.userRecord).toEqual({ w: 11, l: 3, t: 0, playoffResult: "div_loss" });
    await expect(typeIn({ year: SAMPLE_START_YEAR, w: 1, l: 0, t: 0 })).rejects.toThrow(/franchise season/);
    await expect(typeIn({ year: 1977, w: 12, l: 9, t: 0 })).rejects.toThrow(/more than a season/);
  });

  test("a saved season edits in place; a franchise season keeps the record its games give", async () => {
    const { owner, history, typeIn } = await setup();
    await typeIn({ year: 1976, w: 11, l: 3, t: 0, headCoach: "Chuck Fairbanks", note: "Ben Dreith game" });
    const old = (await history(1976))!;
    await owner.mutation(api.history.seasons.update, {
      seasonId: old._id,
      w: 11,
      l: 3,
      t: 0,
      divisionRank: 2,
      seed: 4,
      playoffResult: "div_loss",
      headCoach: "",
      notes: "Lost at Oakland",
    });
    const edited = (await history(1976))!;
    expect(edited.userRecord).toEqual({
      w: 11,
      l: 3,
      t: 0,
      divisionRank: 2,
      seed: 4,
      playoffResult: "div_loss",
    });
    expect(edited.coaching?.headCoach).toBeUndefined();
    expect(edited.notes).toBe("Lost at Oakland");

    const current = (await history(SAMPLE_START_YEAR))!;
    const { w, l, t } = current.userRecord!;
    await expect(
      owner.mutation(api.history.seasons.update, { seasonId: current._id, w: w + 1, l, t }),
    ).rejects.toThrow(/comes from its games/);
    await owner.mutation(api.history.seasons.update, {
      seasonId: current._id,
      w,
      l,
      t,
      divisionRank: 1,
      seed: 1,
      headCoach: "Mike Vrabel",
    });
    expect((await history(SAMPLE_START_YEAR))?.userRecord).toMatchObject({ w, divisionRank: 1, seed: 1 });
  });

  test("strangers cannot edit history", async () => {
    const { t, history } = await setup();
    const season = (await history(SAMPLE_START_YEAR))!;
    const stranger = await asStranger(t);
    await expect(
      stranger.mutation(api.history.seasons.update, { seasonId: season._id, w: 1, l: 0, t: 0 }),
    ).rejects.toThrow(/Not the owner/);
  });
});
