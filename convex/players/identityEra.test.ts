/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { confirmNew } from "../lib/testDraft";
import { setup as setupFranchise, type Draft } from "./identityEra.setup";

const modules = import.meta.glob("/convex/**/*.ts");
const setup = () => setupFranchise(modules);

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("provenance", () => {
  test("a stranger in the first season came off a real roster", async () => {
    const { owner, first, read, named } = await setup();
    const { setKey, draft } = await read("game_box_score", first, "w1");
    await owner.mutation(api.ingestion.review.commit, { setKey, draft: confirmNew(draft) });
    expect((await named("G. Smith"))[0]).toMatchObject({
      isReal: true,
      origin: "screenshot",
      createdSeasonId: first,
    });
  });

  test("a stranger in a later season is a created player", async () => {
    const { owner, later, read, named } = await setup();
    const { setKey, draft } = await read("game_box_score", later, "w1");
    await owner.mutation(api.ingestion.review.commit, { setKey, draft: confirmNew(draft) });
    expect((await named("G. Smith"))[0]).toMatchObject({
      isReal: false,
      origin: "screenshot",
      createdSeasonId: later,
    });
  });

  test("the roster's face list leaves created players out by being fictional", async () => {
    const { owner, later, read, named } = await setup();
    const b = await read("game_box_score", later, "w1");
    await owner.mutation(api.ingestion.review.commit, { setKey: b.setKey, draft: confirmNew(b.draft) });
    const roster = await owner.query(api.players.roster.bySeason, { seasonId: later });
    const created = (await named("G. Smith"))[0]!;
    expect(roster.entries.filter((e) => e.player.isReal).map((e) => e.player._id)).not.toContain(created._id);
  });

  test("a player typed into a move is dated and created like one from a screen", async () => {
    const { t, owner, franchiseId, later } = await setup();
    const players = await t.run(async (ctx) => {
      const { resolvePeople } = await import("../transactions/people");
      const season = (await ctx.db.get("seasons", later))!;
      const [person] = await resolvePeople(ctx, franchiseId, season, [{ name: "T.Newman", position: "WR" }]);
      return person!.player;
    });
    expect(players).toMatchObject({
      displayName: "T. Newman",
      firstName: "T.",
      lastName: "Newman",
      aliases: ["T.Newman"],
      origin: "manual",
      createdSeasonId: later,
      isReal: false,
    });
    expect(await owner.query(api.players.search.byName, { text: "Newman" })).toHaveLength(1);
  });
});

describe("names", () => {
  test("a name printed with a joined initial splits, and a picker finds the alias", async () => {
    const { owner, addPlayer } = await setup();
    const playerId = await addPlayer({
      firstName: "Marcellous",
      lastName: "Hawkins",
      displayName: "Marcellous Hawkins",
    });
    await owner.mutation(api.players.identity.setAliases, { playerId, aliases: ["Cello Hawk"] });
    const hits = await owner.query(api.players.search.byName, { text: "Cello" });
    expect(hits.map((h) => h._id)).toEqual([playerId]);
    expect((await owner.query(api.players.directory.search, { text: "Cello" }))[0]?.playerId).toBe(playerId);
  });

  test("a fuller source renames a one-initial player and keeps the old name", async () => {
    const { t, owner, first, read, addPlayer, named } = await setup();
    const playerId = await addPlayer({
      firstName: "D.",
      lastName: "Maye",
      displayName: "D. Maye",
      position: "QB",
    });
    const { setKey, draft } = await read("roster_page", first);
    if (!("rows" in draft)) throw new Error("not rows");
    const row = { ...draft.rows[0]!, name: "Drake Maye", playerId, accepted: true };
    await owner.mutation(api.ingestion.review.commit, {
      setKey,
      draft: { ...draft, rows: [row] },
    });
    const upgraded = await t.run((ctx) => ctx.db.get("players", playerId));
    expect(upgraded).toMatchObject({ displayName: "Drake Maye", firstName: "Drake", aliases: ["D. Maye"] });
    expect((await named("Drake Maye")).length).toBeGreaterThan(0);
  });
});

describe("tidying older players", () => {
  test("dates players, makes later captures fictional, repairs names and indexes aliases", async () => {
    const { t, owner, franchiseId, first, later, addPlayer, teamId } = await setup();
    const ne = await teamId("NE");
    const entry = (playerId: Id<"players">, seasonId: Id<"seasons">) =>
      t.run((ctx) =>
        ctx.db.insert("rosterEntries", {
          franchiseId,
          seasonId,
          teamId: ne,
          playerId,
          position: "WR",
          status: "active",
        }),
      );
    const created = await addPlayer({
      firstName: "",
      lastName: "M.Hawkins",
      displayName: "M.Hawkins",
      aliases: ["Cello"],
    });
    await entry(created, later);
    const firstYear = await addPlayer({ firstName: "Zed", lastName: "Quill", displayName: "Zed Quill" });
    await entry(firstYear, first);
    await entry(firstYear, later);
    const marked = await addPlayer({
      firstName: "Own",
      lastName: "Pick",
      displayName: "Own Pick",
      isReal: false,
    });
    await entry(marked, first);

    expect(await owner.query(api.players.tidy.status, {})).toMatchObject({ pending: true, job: null });
    await owner.mutation(api.players.tidy.start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const status = await owner.query(api.players.tidy.status, {});
    expect(status).toMatchObject({ pending: false, job: { status: "done", fictional: 1, renamed: 1 } });
    const read = (id: Id<"players">) => t.run((ctx) => ctx.db.get("players", id));
    expect(await read(created)).toMatchObject({
      displayName: "M. Hawkins",
      firstName: "M.",
      lastName: "Hawkins",
      aliases: ["Cello", "M.Hawkins"],
      aliasesText: "Cello M.Hawkins",
      origin: "screenshot",
      createdSeasonId: later,
      isReal: false,
    });
    expect(await read(firstYear)).toMatchObject({ isReal: true, createdSeasonId: first });
    expect(await read(marked)).toMatchObject({ isReal: false, createdSeasonId: first });
  });

  test("starting again while it runs does nothing, and it only touches untidied players", async () => {
    const { t, owner, addPlayer } = await setup();
    const tidied = await addPlayer({ displayName: "Done Already", origin: "manual", isReal: true });
    await owner.mutation(api.players.tidy.start, {});
    await owner.mutation(api.players.tidy.start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const jobs = await t.run((ctx) => ctx.db.query("identityTidies").collect());
    expect(jobs).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.get("players", tidied))).toMatchObject({ origin: "manual" });
  });
});

describe("identity tools", () => {
  test("a duplicate shows on the player page, with where each was seen", async () => {
    const { t, owner, first, addPlayer, named, franchiseId } = await setup();
    const maye = (await named("Drake Maye"))[0]!;
    const dupe = await addPlayer({
      firstName: "Drake",
      lastName: "Maey",
      displayName: "Drake Maey",
      position: "QB",
      origin: "screenshot",
      createdSeasonId: first,
    });
    await t.run((ctx) =>
      ctx.db.insert("playerNameAssignments", {
        franchiseId,
        seasonId: first,
        teamAbbr: "NE",
        normalizedName: "d maey",
        playerId: dupe,
      }),
    );
    const similar = await owner.query(api.players.identity.duplicatesOf, { playerId: dupe });
    expect(similar.map((s) => s.playerId)).toContain(maye._id);
    expect(await owner.query(api.players.identity.seenIn, { playerId: dupe })).toMatchObject({
      origin: "screenshot",
      createdYear: SAMPLE_START_YEAR,
      games: 0,
      printed: ["d maey"],
    });
    const seen = await owner.query(api.players.identity.seenIn, { playerId: maye._id });
    expect(seen.seasons[0]).toMatchObject({ year: SAMPLE_START_YEAR, teams: ["NE"] });
    expect(seen.games).toBeGreaterThan(0);
  });

  test("a merge keeps the earlier sighting and a real half makes the person real", async () => {
    const { t, owner, first, later, addPlayer } = await setup();
    const kept = await addPlayer({
      firstName: "Zed",
      lastName: "Quill",
      displayName: "Zed Quill",
      isReal: false,
      createdSeasonId: later,
    });
    const other = await addPlayer({
      firstName: "Zed",
      lastName: "Quil",
      displayName: "Zed Quil",
      espnId: 123,
      espnLeague: "college",
      createdSeasonId: first,
      aliases: ["Z. Quil"],
    });
    await owner.mutation(api.players.identity.merge, { sourceId: other, targetId: kept });
    expect(await t.run((ctx) => ctx.db.get("players", kept))).toMatchObject({
      isReal: true,
      espnId: 123,
      espnLeague: "college",
      createdSeasonId: first,
      aliases: ["Zed Quil", "Z. Quil"],
      aliasesText: "Zed Quil Z. Quil",
    });
  });

  test("a name corrected on any screen is offered, not only a box score", async () => {
    const { owner, first, read, addPlayer } = await setup();
    const misread = await addPlayer({ firstName: "G.", lastName: "Smith", displayName: "G. Smith" });
    const { setKey, draft } = await read("game_log", first, "w1");
    const corrected = confirmNew({
      ...draft,
      lines:
        "lines" in draft
          ? draft.lines.map((l) => (l.name === "G. Smith" ? { ...l, name: "Gus Smith" } : l))
          : [],
    }) as Draft;
    await owner.mutation(api.ingestion.review.commit, { setKey, draft: corrected });
    expect(await owner.query(api.players.identity.nameCorrections, {})).toMatchObject([
      { from: "G. Smith", to: "Gus Smith", players: [{ playerId: misread }] },
    ]);
  });
});
