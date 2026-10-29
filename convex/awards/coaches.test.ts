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
  const team = (abbr: string) =>
    t.run(
      async (ctx) =>
        (await ctx.db
          .query("teams")
          .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
          .first())!._id,
    );
  const player = (name: string) =>
    t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", name),
        )
        .first(),
    );
  const winners = async (type: string) =>
    (await owner.query(api.awards.awards.bySeason, { seasonId })).filter((a) => a.type === type);
  return { t, owner, seasonId, team, player, winners };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("coaches", () => {
  test("created coaches list beside the bank, one per spelling", async () => {
    const { owner, team } = await setup();
    const ne = await team("NE");
    await owner.mutation(api.awards.coaches.create, { name: "  Coach   Custom ", teamId: ne });
    const list = await owner.query(api.awards.coaches.list, {});
    expect(list.map((c) => [c.name, c.team?.abbr])).toEqual([["Coach Custom", "NE"]]);
    await expect(owner.mutation(api.awards.coaches.create, { name: "coach custom" })).rejects.toThrow(
      /already been created/,
    );
    await expect(owner.mutation(api.awards.coaches.create, { name: "andy reid" })).rejects.toThrow(
      /Andy Reid is already in the coach list/,
    );
    await owner.mutation(api.awards.coaches.remove, { coachId: list[0]!._id });
    expect(await owner.query(api.awards.coaches.list, {})).toEqual([]);
  });

  test("Coach of the Year goes to a coach: the bank's spelling, a new name created", async () => {
    const { owner, seasonId, team, winners } = await setup();
    const kc = await team("KC");
    await owner.mutation(api.awards.assign.assignCoach, { seasonId, name: "andy reid", teamId: kc });
    expect((await winners("COY")).map((w) => [w.name, w.player, w.team?.abbr])).toEqual([
      ["Andy Reid", null, "KC"],
    ]);
    expect(await owner.query(api.awards.coaches.list, {})).toEqual([]);

    await owner.mutation(api.awards.assign.assignCoach, { seasonId, name: "Franchise Legend" });
    expect((await winners("COY")).map((w) => w.name)).toEqual(["Franchise Legend"]);
    expect((await owner.query(api.awards.coaches.list, {})).map((c) => c.name)).toEqual(["Franchise Legend"]);

    const maye = (await owner.query(api.players.search.byName, { text: "Drake Maye" }))[0]!;
    await expect(
      owner.mutation(api.awards.assign.assign, { seasonId, type: "COY", playerId: maye._id }),
    ).rejects.toThrow(/goes to a coach/);
  });

  test("conference awards have a winner per conference", async () => {
    const { owner, seasonId, winners } = await setup();
    const [maye] = await owner.query(api.players.search.byName, { text: "Drake Maye" });
    const [allen] = await owner.query(api.players.search.byName, { text: "Josh Allen" });
    await expect(
      owner.mutation(api.awards.assign.assign, { seasonId, type: "OPOY", playerId: maye!._id }),
    ).rejects.toThrow(/AFC or NFC/);
    for (const [conference, p] of [
      ["AFC", maye!],
      ["NFC", allen!],
    ] as const) {
      await owner.mutation(api.awards.assign.assign, { seasonId, type: "OPOY", conference, playerId: p._id });
    }
    expect((await winners("OPOY")).map((w) => [w.conference, w.name]).sort()).toEqual([
      ["AFC", "Drake Maye"],
      ["NFC", "Josh Allen"],
    ]);
    await owner.mutation(api.awards.assign.clear, { seasonId, type: "OPOY", conference: "AFC" });
    expect((await winners("OPOY")).map((w) => w.conference)).toEqual(["NFC"]);
  });

  test("an imported Coach of the Year is a coach, never a new player", async () => {
    const { owner, seasonId, player, winners } = await setup();
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "yearly_awards",
      seasonId,
    });
    const entry = (await owner.query(api.ingestion.manual.get, { draftId }))!;
    if (!("rows" in entry.draft)) throw new Error("not a row draft");
    const row = emptyRow(rowTarget("yearly_awards").spec, entry.draft, {
      name: "Imported Coach",
      teamAbbr: "NE",
    });
    const draft = { ...entry.draft, rows: [{ ...row, values: { ...row.values, award: "COY" } }] };
    await owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft });

    expect((await winners("COY")).map((w) => [w.name, w.team?.abbr])).toEqual([["Imported Coach", "NE"]]);
    expect(await player("Imported Coach")).toBeNull();
    expect((await owner.query(api.awards.coaches.list, {})).map((c) => c.name)).toEqual(["Imported Coach"]);
  });

  test("is private", async () => {
    const { t, seasonId } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.awards.coaches.list, {})).rejects.toThrow();
    await expect(stranger.mutation(api.awards.coaches.create, { name: "Someone" })).rejects.toThrow();
    await expect(
      stranger.mutation(api.awards.assign.assignCoach, { seasonId, name: "Andy Reid" }),
    ).rejects.toThrow();
  });
});
