/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { confirmNew } from "../lib/testDraft";
import { setup as setupFranchise, type Draft } from "../players/identityEra.setup";

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

const lineNamed = (draft: Draft, name: string) => {
  if (!("lines" in draft)) throw new Error("not a box score");
  return draft.lines.find((l) => l.name === name)!;
};

describe("game-aware resolution", () => {
  test("the week's scheduled opponent is looked up, before the game itself exists", async () => {
    const { t, franchiseId, later, read, addPlayer, teamId } = await setup();
    const ne = await teamId("NE");
    const buf = await teamId("BUF");
    const playerId = await addPlayer({ firstName: "Grant", lastName: "Smith", displayName: "Grant Smith" });
    await t.run(async (ctx) => {
      await ctx.db.insert("leagueGames", {
        franchiseId,
        seasonId: later,
        weekKey: "w1",
        homeTeamId: ne,
        awayTeamId: buf,
      });
      await ctx.db.insert("rosterEntries", {
        franchiseId,
        seasonId: later,
        teamId: buf,
        playerId,
        position: "WR",
        status: "active",
      });
    });
    const { draft } = await read("game_box_score", later, "w1");
    expect(lineNamed(draft, "G. Smith")).toMatchObject({ playerId, match: { status: "matched" } });
  });

  test("the fallback search skips retired players, and a roster still holds them", async () => {
    const { t, first, addPlayer, teamId } = await setup();
    const retired = await addPlayer({
      firstName: "Old",
      lastName: "Quill",
      displayName: "Old Quill",
      retired: true,
    });
    const active = await addPlayer({ firstName: "New", lastName: "Quill", displayName: "New Quill" });
    const pool = await t.query(internal.ingestion.candidates.forNames, {
      seasonId: first,
      teamAbbrs: [],
      names: ["Quill"],
    });
    expect(pool.map((c) => c.playerId)).toEqual([active]);

    const ne = await teamId("NE");
    await t.run(async (ctx) => {
      const season = (await ctx.db.get("seasons", first))!;
      await ctx.db.insert("rosterEntries", {
        franchiseId: season.franchiseId,
        seasonId: first,
        teamId: ne,
        playerId: retired,
        position: "WR",
        status: "released",
      });
    });
    const withRoster = await t.query(internal.ingestion.candidates.forNames, {
      seasonId: first,
      teamAbbrs: ["NE"],
      names: [],
    });
    expect(withRoster.find((c) => c.playerId === retired)).toMatchObject({ inactive: true, teamAbbr: "NE" });
  });

  test("last season's choice carries forward unless the player has left", async () => {
    const { t, franchiseId, first, later, addPlayer, teamId } = await setup();
    const playerId = await addPlayer({ firstName: "Zed", lastName: "Quill", displayName: "Zed Quill" });
    await t.run((ctx) =>
      ctx.db.insert("playerNameAssignments", {
        franchiseId,
        seasonId: first,
        teamAbbr: "NE",
        normalizedName: "z quill",
        playerId,
      }),
    );
    const names = [{ name: "Z. Quill", teamAbbr: "NE" }];
    const args = { seasonId: later, names };
    expect(await t.query(internal.ingestion.candidates.assignments, args)).toMatchObject([
      { playerId, carried: true },
    ]);
    // Same team, a different season's choice is not borrowed for another team.
    expect(
      await t.query(internal.ingestion.candidates.assignments, {
        seasonId: later,
        names: [{ name: "Z. Quill", teamAbbr: "BUF" }],
      }),
    ).toEqual([]);

    const buf = await teamId("BUF");
    await t.run((ctx) =>
      ctx.db.insert("rosterEntries", {
        franchiseId,
        seasonId: later,
        teamId: buf,
        playerId,
        position: "WR",
        status: "active",
      }),
    );
    expect(await t.query(internal.ingestion.candidates.assignments, args)).toEqual([]);
  });

  test("a team's known players come back by position, active first", async () => {
    const { t, owner, franchiseId, first, addPlayer, teamId } = await setup();
    const buf = await teamId("BUF");
    const entry = (playerId: Id<"players">, status: "active" | "released", ovr: number) =>
      t.run((ctx) =>
        ctx.db.insert("rosterEntries", {
          franchiseId,
          seasonId: first,
          teamId: buf,
          playerId,
          position: "WR",
          status,
          ovr,
        }),
      );
    const gone = await addPlayer({ displayName: "Gone Quill" });
    const here = await addPlayer({ displayName: "Here Quill" });
    await entry(gone, "released", 90);
    await entry(here, "active", 70);
    const offered = await owner.query(api.players.search.teamRoster, {
      seasonId: first,
      teamAbbr: "BUF",
      position: "WR",
    });
    expect(offered.map((p) => p._id)).toEqual([here, gone]);
    const quarterbacks = await owner.query(api.players.search.teamRoster, {
      seasonId: first,
      teamAbbr: "BUF",
      position: "QB",
    });
    expect(quarterbacks.map((p) => p._id)).not.toContain(here);
  });
});

describe("draft classes", () => {
  test("a recommitted class reuses its players and sets their age and origin", async () => {
    const { t, owner, franchiseId, later, read, named } = await setup();
    const once = await read("draft_results", later);
    if (!("rows" in once.draft)) throw new Error("not rows");
    const accept = (draft: typeof once.draft) =>
      "rows" in draft ? { ...draft, rows: draft.rows.map((r) => ({ ...r, accepted: true })) } : draft;
    await owner.mutation(api.ingestion.review.commit, { setKey: once.setKey, draft: accept(once.draft) });
    const [rookie] = await named("Rookie Corner");
    expect(rookie).toMatchObject({
      origin: "draft",
      isReal: false,
      createdSeasonId: later,
      ageAnchor: { age: 21, year: SAMPLE_START_YEAR + 1 },
    });

    const again = await read("draft_results", later);
    if (!("rows" in again.draft)) throw new Error("not rows");
    expect(again.draft.rows.map((r) => r.match?.status)).toEqual(["matched", "matched"]);
    expect(again.draft.rows[0]?.playerId).toBe(rookie?._id);
    await owner.mutation(api.ingestion.review.commit, { setKey: again.setKey, draft: accept(again.draft) });
    expect(await named("Rookie Corner")).toHaveLength(1);
    expect(await named("R. Tackle")).toHaveLength(1);
    const picks = await t.run((ctx) =>
      ctx.db
        .query("draftPicks")
        .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", later))
        .collect(),
    );
    expect(picks).toHaveLength(2);
    expect(picks.every((p) => p.franchiseId === franchiseId)).toBe(true);
  });

  test("two reads committed in turn still make one player per slot", async () => {
    const { owner, later, read, named } = await setup();
    const a = await read("draft_results", later);
    const b = await read("draft_results", later);
    const accept = (draft: Draft) =>
      "rows" in draft ? { ...draft, rows: draft.rows.map((r) => ({ ...r, accepted: true })) } : draft;
    await owner.mutation(api.ingestion.review.commit, { setKey: a.setKey, draft: accept(a.draft) });
    await owner.mutation(api.ingestion.review.commit, { setKey: b.setKey, draft: accept(b.draft) });
    expect(await named("Rookie Corner")).toHaveLength(1);
  });

  test("a prospect typed in earlier is matched by name and college", async () => {
    const { owner, later, read } = await setup();
    const typed = await owner.mutation(api.players.create.create, {
      displayName: "Rookie Corner",
      position: "CB",
      isReal: false,
      bio: { college: "Georgia" },
      entry: {
        seasonId: later,
        teamId: (await owner.query(api.franchise.franchises.getActive, {}))!.franchise.userTeamId,
        patch: {},
      },
    });
    const { draft } = await read("draft_results", later);
    if (!("rows" in draft)) throw new Error("not rows");
    expect(draft.rows[0]).toMatchObject({ playerId: typed, match: { status: "matched" } });
  });
});

describe("commit guards", () => {
  test("a game will not commit a name nobody decided on", async () => {
    const { owner, first, read } = await setup();
    const { setKey, draft } = await read("game_box_score", first, "w1");
    await expect(owner.mutation(api.ingestion.review.commit, { setKey, draft })).rejects.toThrow(
      /pick a player or create them as new/,
    );
    expect(lineNamed(draft, "G. Smith").confirmedNew).toBeUndefined();
    await owner.mutation(api.ingestion.review.commit, { setKey, draft: confirmNew(draft) });
  });

  test("an accepted row with an unsettled name will not commit until someone decides", async () => {
    const { owner, first, read, addPlayer } = await setup();
    await addPlayer({ firstName: "Dan", lastName: "Maye", displayName: "Dan Maye", position: "QB" });
    const { setKey, draft } = await read("yearly_awards", first);
    if (!("rows" in draft)) throw new Error("not rows");
    const unsettled = draft.rows.find((r) => r.match?.status === "ambiguous");
    expect(unsettled).toBeDefined();
    const accepted = { ...draft, rows: draft.rows.map((r) => ({ ...r, accepted: true })) };
    await expect(owner.mutation(api.ingestion.review.commit, { setKey, draft: accepted })).rejects.toThrow(
      /choose which player/,
    );
    const decided = {
      ...accepted,
      rows: accepted.rows.map((r) => (r.id === unsettled?.id ? { ...r, confirmedNew: true } : r)),
    };
    await owner.mutation(api.ingestion.review.commit, { setKey, draft: decided });
  });
});
