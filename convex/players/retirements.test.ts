/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { asStranger } from "../lib/testOwner";
import { FIRST, setup } from "./rosterTruth.setup";

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("retirements", () => {
  async function withVeteran() {
    const context = await setup();
    const { t, season, roster, nextSeason } = context;
    const [veteran] = await roster(season(FIRST));
    await t.run((ctx) => ctx.db.patch("rosterEntries", veteran!._id, { position: "WR", age: 35 }));
    const next = await nextSeason();
    return { ...context, veteran: veteran!, next };
  }

  test("suggests the old and unseen, and a retirement is a move that can be undone", async () => {
    const { t, owner, roster, veteran, next } = await withVeteran();
    await t.run((ctx) => ctx.db.patch("seasons", next, { status: "upcoming" }));
    const suggested = await owner.query(api.players.retirements.suggestions, { seasonId: next });
    expect(suggested.map((p) => p.playerId)).toEqual([veteran.playerId]);
    expect(suggested[0]).toMatchObject({ age: 36, userTeam: true });

    await owner.mutation(api.players.retirements.decide, { seasonId: next, retire: [veteran.playerId] });
    const player = await t.run((ctx) => ctx.db.get("players", veteran.playerId));
    expect(player?.retired).toBe(true);
    const entry = (await roster(next)).find((e) => e.playerId === veteran.playerId);
    expect(entry?.status).toBe("released");

    const move = await t.run((ctx) =>
      ctx.db
        .query("transactions")
        .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", next).eq("type", "retire"))
        .first(),
    );
    await owner.mutation(api.transactions.moves.remove, { transactionId: move!._id });
    expect((await t.run((ctx) => ctx.db.get("players", veteran.playerId)))?.retired).toBe(false);
    expect((await roster(next)).find((e) => e.playerId === veteran.playerId)?.status).toBe("active");
  });

  test("the checklist waits on the list until it is gone through", async () => {
    const { t, owner, next } = await withVeteran();
    await t.run((ctx) => ctx.db.patch("seasons", next, { status: "upcoming" }));
    const item = async () =>
      (await owner.query(api.seasons.checklist.forSeason, { seasonId: next }))?.groups
        .find((g) => g.key === "offseason")
        ?.items.find((i) => i.key === "retirements");
    expect(await item()).toMatchObject({ done: false, detail: "1 player to look at" });
    await owner.mutation(api.players.retirements.decide, { seasonId: next, retire: [] });
    expect(await item()).toMatchObject({ done: true });
  });

  test("an ingested retire transaction applies the flag", async () => {
    const { t, owner, season, roster, userTeam } = await setup();
    const seasonId = season(FIRST);
    const [entry] = await roster(seasonId);
    const player = (await t.run((ctx) => ctx.db.get("players", entry!.playerId)))!;
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "transactions",
      seasonId,
    });
    const manual = (await owner.query(api.ingestion.manual.get, { draftId }))!;
    if (!("rows" in manual.draft)) throw new Error("not a row draft");
    await owner.mutation(api.ingestion.manualCommit.commit, {
      draftId,
      draft: {
        ...manual.draft,
        rows: [
          {
            id: "r",
            accepted: true,
            name: player.displayName,
            teamAbbr: userTeam.abbr,
            values: { type: "retire" },
            playerId: player._id,
            match: null,
          },
        ],
      },
    });
    expect((await t.run((ctx) => ctx.db.get("players", player._id)))?.retired).toBe(true);
    expect((await roster(seasonId)).find((e) => e.playerId === player._id)?.status).toBe("released");
  });

  test("strangers are refused", async () => {
    const { t, season } = await setup();
    const stranger = await asStranger(t);
    await expect(
      stranger.query(api.seasons.checklist.forSeason, { seasonId: season(FIRST) }),
    ).rejects.toThrow(/Not the owner/);
  });
});

describe("the season checklist", () => {
  test("reads the season's data, and skips imported seasons", async () => {
    const { owner, season, active } = await setup();
    const data = await owner.query(api.seasons.checklist.forSeason, { seasonId: season(FIRST) });
    expect(data?.groups.map((g) => g.key)).toEqual(["offseason", "preseason", "week", "end"]);
    const offseason = data?.groups.find((g) => g.key === "offseason");
    expect(offseason?.items.map((i) => i.key)).not.toContain("carry");
    expect(data?.coverage.map((c) => c.key)).toEqual(["box", "team", "scoring", "standings", "awards"]);
    const imported = active.seasons.find((s) => s.year < FIRST);
    if (imported) {
      expect(await owner.query(api.seasons.checklist.forSeason, { seasonId: imported._id })).toBeNull();
    }
  });

  test("a roster page checks its item", async () => {
    const { owner, season, roster, commitPage } = await setup();
    const seasonId = season(FIRST);
    const item = async (key: string) =>
      (await owner.query(api.seasons.checklist.forSeason, { seasonId }))?.groups
        .flatMap((g) => g.items)
        .find((i) => i.key === key);
    expect((await item("roster_page"))?.done).toBe(false);
    await commitPage(seasonId, (await roster(seasonId)).slice(0, 2));
    expect((await item("roster_page"))?.done).toBe(true);
    expect((await item("depth"))?.done).toBe(true);
  });
});
