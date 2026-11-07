/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { gameFileDraft } from "../../shared/ingestion/gameFile";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

const YEAR = SAMPLE_START_YEAR + 1;

/** An exported game in the sample franchise's second season, a week it has no game yet. */
const FILE = {
  year: YEAR,
  week: "w1",
  awayAbbr: "MIA",
  homeAbbr: "NE",
  played: true,
  awayScore: 7,
  homeScore: 10,
  overtime: false,
  lineScore: { home: [3, 0, 7, 0], away: [0, 7, 0, 0] },
  lines: [
    { teamAbbr: "NE", name: "Drake Maye", position: "QB", stats: { passCmp: 18, passAtt: 25, passYds: 212 } },
    { teamAbbr: "MIA", name: "Zed Nobody", position: "WR", stats: { rec: 3, recYds: 41 } },
  ],
  teams: [
    { teamAbbr: "MIA", stats: { passYds: 180, rushYds: 60 } },
    { teamAbbr: "NE", stats: { passYds: 212, rushYds: 95 } },
  ],
  plays: [
    { order: 1, period: 1, clock: 300, teamAbbr: "NE", kind: "fg", pat: null, homeScore: 3, awayScore: 0 },
    {
      order: 2,
      period: 2,
      clock: 90,
      teamAbbr: "MIA",
      kind: "other",
      pat: "kick",
      homeScore: 3,
      awayScore: 7,
    },
    {
      order: 3,
      period: 3,
      clock: 45,
      teamAbbr: "NE",
      kind: "other",
      pat: "kick",
      homeScore: 10,
      awayScore: 7,
    },
  ],
};

function args(file: unknown) {
  const read = gameFileDraft<Id<"players">>(file);
  if (!read.ok) throw new Error(read.error);
  return { year: read.year, weekKey: read.weekKey, draft: read.draft };
}

/** Imports a file and returns its entry, failing the test if it was refused. */
async function filed(owner: Awaited<ReturnType<typeof asOwner>>, file: unknown) {
  const result = await owner.action(api.ingestion.gameFile.importFile, args(file));
  if (!result.ok) throw new Error(result.error);
  return result.draftId;
}

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const entry = async (draftId: Id<"manualDrafts">) => {
    const found = await owner.query(api.ingestion.manual.get, { draftId });
    if (!found) throw new Error("entry missing");
    return found;
  };
  return { t, owner, entry };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("game files", () => {
  test("a file lands as a game log entry with resolved names, then commits as the week's game", async () => {
    const { t, owner, entry } = await setup();
    const draftId = await filed(owner, FILE);
    const found = await entry(draftId);
    expect(found).toMatchObject({
      targetKey: "game_log",
      status: "open",
      weekKey: "w1",
      season: { year: YEAR },
    });
    if (found.draft.target !== "game_log") throw new Error("wrong target");
    const [maye, nobody] = found.draft.lines;
    expect(maye?.match.status).toBe("matched");
    expect(maye?.playerId).not.toBeNull();
    expect(nobody?.match.status).toBe("new");
    expect(found.draft.teams).toHaveLength(2);
    expect(found.draft.plays).toHaveLength(3);

    const draft = {
      ...found.draft,
      lines: found.draft.lines.map((l) => (l.playerId ? l : { ...l, confirmedNew: true })),
    };
    const { gameId } = await owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get("games", gameId!))).toMatchObject({
      weekKey: "w1",
      status: "played",
      homeScore: 10,
      awayScore: 7,
      result: "W",
    });
    const box = await owner.query(api.games.boxScore.get, { gameId: gameId! });
    const lines = box.teams.flatMap((team) => team.lines);
    expect(lines.find((l) => l.name === "Drake Maye")?.stats.passYds).toBe(212);
  });

  test("importing the same file again replaces its open entry instead of adding one", async () => {
    const { owner, entry } = await setup();
    const first = await filed(owner, FILE);
    const again = await filed(owner, { ...FILE, homeScore: 13 });
    expect(again).toBe(first);
    expect((await entry(first)).draft).toMatchObject({ game: { homeScore: 13 } });
    expect(await owner.query(api.ingestion.manual.listOpen, {})).toHaveLength(1);
  });

  test("a file is refused when it is not the user's game, or its season or game does not fit", async () => {
    const { owner } = await setup();
    const refusal = async (
      call: Parameters<typeof owner.action<typeof api.ingestion.gameFile.importFile>>[1],
    ) => {
      const result = await owner.action(api.ingestion.gameFile.importFile, call);
      return result.ok ? null : result.error;
    };
    expect(await refusal(args({ ...FILE, homeAbbr: "BUF" }))).toMatch(/not your game/);
    expect(await refusal(args({ ...FILE, year: 1990 }))).toMatch(/no 1990 season/);
    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    const first = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!;
    const { games } = await owner.query(api.games.schedule.bySeason, { seasonId: first._id });
    const scheduled = games.find((g) => g.weekKey === "w1")!;
    expect(await refusal({ ...args(FILE), gameId: scheduled._id })).toMatch(/not this game/);
    // The sample's first season plays LV in week 1.
    expect(await refusal(args({ ...FILE, year: SAMPLE_START_YEAR }))).toMatch(/against LV here, not MIA/);
    expect(await owner.query(api.ingestion.manual.listOpen, {})).toEqual([]);
  });

  test("only the owner can import a file", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.action(api.ingestion.gameFile.importFile, args(FILE))).rejects.toThrow();
  });
});
