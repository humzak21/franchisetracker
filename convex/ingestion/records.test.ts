/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { emptyRow } from "../../shared/ingestion/manual";
import { rowsFromCsv } from "../../shared/ingestion/rows/csvRows";
import { rowTarget } from "../../shared/ingestion/targets";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const spec = rowTarget("records_list").spec;

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  /** Types a records list in (from a CSV) and commits it. */
  const commitList = async (meta: Record<string, string>, csv: string) => {
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "records_list",
      seasonId,
    });
    const entry = (await owner.query(api.ingestion.manual.get, { draftId }))!;
    if (!("rows" in entry.draft)) throw new Error("not a row draft");
    const { rows } = rowsFromCsv(csv, spec, entry.draft);
    await owner.mutation(api.ingestion.manualCommit.commit, {
      draftId,
      draft: { ...entry.draft, meta: { ...entry.draft.meta, ...meta }, rows },
    });
  };
  const sacks = async () =>
    (
      await owner.query(api.stats.records.lists, {
        book: "league",
        split: "regular",
        scope: "career",
        category: "defense",
      })
    ).lists.find((l) => l.statKey === "sacks")?.entries ?? [];
  return { t, owner, seasonId, commitList, sacks };
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

const CAREER_SACKS = { book: "league", scope: "career", split: "regular", stat: "sacks" };

describe("records lists", () => {
  test("a list lands as typed records with team and season, and a second read updates instead of adding", async () => {
    const { commitList, sacks } = await setup();
    await commitList(
      CAREER_SACKS,
      "Rk,Player,Tm,Season,Number\n1,Bruce Smith,BUF,2003,200\n2,Reggie White,PHI,2000,198\n",
    );
    expect((await sacks()).slice(0, 2)).toMatchObject([
      { rank: 1, name: "Bruce Smith", team: { abbr: "BUF" }, year: 2003, value: 200 },
      { rank: 2, name: "Reggie White", team: { abbr: "PHI" }, year: 2000, value: 198 },
    ]);

    await commitList(CAREER_SACKS, "player,team,year,value\nbruce smith,BUF,2003,200.5\n");
    const after = await sacks();
    expect(after.filter((e) => e.name.toLowerCase() === "bruce smith")).toHaveLength(1);
    expect(after[0]).toMatchObject({ name: "bruce smith", value: 200.5 });
  });

  test("season lists keep a player's two seasons apart", async () => {
    const { owner, commitList } = await setup();
    await commitList(
      { book: "team", scope: "season", split: "regular", stat: "passTd" },
      "player,team,season,value\nTom Brady,NE,2007,50\nTom Brady,NE,2015,36\n",
    );
    const { lists } = await owner.query(api.stats.records.lists, {
      book: "team",
      split: "regular",
      scope: "season",
      category: "passing",
    });
    const brady = lists.find((l) => l.statKey === "passTd")!.entries.filter((e) => e.name === "Tom Brady");
    expect(brady.map((e) => e.year)).toEqual([2007, 2015]);
  });

  test("a list without its stat cannot commit", async () => {
    const { commitList } = await setup();
    await expect(
      commitList({ book: "league", scope: "career", split: "regular" }, "player,value\nBruce Smith,200\n"),
    ).rejects.toThrow(/stat/i);
  });

  test("screenshots of a list go through extraction and review like any screen", async () => {
    const { t, owner, seasonId, sacks } = await setup();
    const image = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })),
    );
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [image],
      source: "web",
      targetKey: "records_list",
      seasonId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const draft = (await owner.query(api.ingestion.review.get, { setKey: setKey! })).extraction!.draft;
    if (!("rows" in draft)) throw new Error("not a row draft");
    expect(draft.meta).toMatchObject(CAREER_SACKS);
    const accepted = { ...draft, rows: draft.rows.map((r) => ({ ...r, accepted: true })) };
    await owner.mutation(api.ingestion.review.commit, { setKey: setKey!, draft: accepted });
    expect((await sacks()).map((e) => e.name).slice(0, 3)).toEqual([
      "Bruce Smith",
      "Reggie White",
      "Kevin Greene",
    ]);
  });

  test("a typed row with no number is refused", async () => {
    const { owner, seasonId } = await setup();
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "records_list",
      seasonId,
    });
    const entry = (await owner.query(api.ingestion.manual.get, { draftId }))!;
    if (!("rows" in entry.draft)) throw new Error("not a row draft");
    const row = emptyRow(spec, entry.draft, { name: "Nobody" });
    await expect(
      owner.mutation(api.ingestion.manualCommit.commit, {
        draftId,
        draft: { ...entry.draft, meta: CAREER_SACKS, rows: [row] },
      }),
    ).rejects.toThrow();
  });
});
