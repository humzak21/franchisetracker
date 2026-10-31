/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { FIRST, setup } from "./rosterTruth.setup";

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("carry-over", () => {
  test("ages contracts, and a user-team deal that runs out waits on the owner", async () => {
    const { t, season, roster, nextSeason } = await setup();
    const [ending, running] = await roster(season(FIRST));
    await t.run(async (ctx) => {
      await ctx.db.patch("rosterEntries", ending!._id, {
        contract: { years: 1, apy: 3_000_000, expiresYear: FIRST },
      });
      await ctx.db.patch("rosterEntries", running!._id, {
        contract: { years: 3, total: 30_000_000, expiresYear: FIRST + 2 },
      });
    });
    const next = await nextSeason();
    const carried = await roster(next);
    expect(carried.find((e) => e.playerId === ending!.playerId)).toMatchObject({
      status: "unsigned",
      contract: { years: 0, apy: 3_000_000 },
    });
    expect(carried.find((e) => e.playerId === running!.playerId)).toMatchObject({
      status: "active",
      contract: { years: 2, apy: 10_000_000, expiresYear: FIRST + 2 },
    });
  });

  test("a re-signing settles an expired deal, and deleting it brings the prompt back", async () => {
    const { t, owner, season, roster, nextSeason, userTeamId } = await setup();
    const [ending] = await roster(season(FIRST));
    await t.run((ctx) => ctx.db.patch("rosterEntries", ending!._id, { contract: { years: 1 } }));
    const next = await nextSeason();
    const transactionId = await owner.mutation(api.transactions.moves.save, {
      seasonId: next,
      type: "resign",
      phase: "resign",
      teamId: userTeamId,
      playersIn: [{ playerId: ending!.playerId }],
      playersOut: [],
      picksIn: [],
      picksOut: [],
      contract: { years: 2, apy: 4_000_000 },
    });
    const status = async () => (await roster(next)).find((e) => e.playerId === ending!.playerId)?.status;
    expect(await status()).toBe("active");
    await owner.mutation(api.transactions.moves.remove, { transactionId });
    expect(await status()).toBe("unsigned");
  });

  test("another team keeps who was seen in the last two seasons, and starts the clock on the rest", async () => {
    const { t, season, roster, nextSeason, otherTeam, franchiseId } = await setup();
    const from = season(FIRST);
    const makePlayer = (name: string, lastSeenYear?: number) =>
      t.run(async (ctx) => {
        const playerId = await ctx.db.insert("players", {
          franchiseId,
          firstName: "A",
          lastName: name,
          displayName: `A ${name}`,
          position: "WR",
          isReal: false,
          retired: false,
          aliases: [],
          lastSeenYear,
        });
        await ctx.db.insert("rosterEntries", {
          franchiseId,
          seasonId: from,
          teamId: otherTeam._id,
          playerId,
          position: "WR",
          status: "active",
        });
        return playerId;
      });
    const recent = await makePlayer("Recent", FIRST);
    const lastYear = await makePlayer("LastYear", FIRST - 1);
    const ghost = await makePlayer("Ghost", FIRST - 2);
    const undated = await makePlayer("Undated");

    const next = await nextSeason();
    const carried = (await roster(next, otherTeam._id)).map((e) => e.playerId);
    expect(carried).toContain(recent);
    expect(carried).toContain(lastYear);
    expect(carried).toContain(undated);
    expect(carried).not.toContain(ghost);
    expect((await t.run((ctx) => ctx.db.get("players", undated)))?.lastSeenYear).toBe(FIRST);
  });

  test("the user team is never pruned, and a team past the old cap carries whole", async () => {
    const { t, season, roster, nextSeason, userTeamId, franchiseId } = await setup();
    const from = season(FIRST);
    const before = await roster(from);
    await t.run(async (ctx) => {
      for (const entry of before) {
        await ctx.db.patch("players", entry.playerId, { lastSeenYear: FIRST - 5 });
      }
      for (let i = before.length; i < 220; i++) {
        const playerId = await ctx.db.insert("players", {
          franchiseId,
          firstName: "Extra",
          lastName: `Player${i}`,
          displayName: `Extra Player${i}`,
          position: "CB",
          isReal: false,
          retired: false,
          aliases: [],
        });
        await ctx.db.insert("rosterEntries", {
          franchiseId,
          seasonId: from,
          teamId: userTeamId,
          playerId,
          position: "CB",
          status: "active",
        });
      }
    });
    expect(await roster(await nextSeason())).toHaveLength(220);
  });
});

describe("a roster page", () => {
  test("releases who it leaves off, sets the depth chart, and can be undone", async () => {
    const { owner, season, roster, commitPage, userTeamId } = await setup();
    const seasonId = season(FIRST);
    const before = await roster(seasonId);
    const [gone, kept, ...rest] = before;
    const page = [kept!, ...rest];

    const preview = await owner.query(api.players.rosterSync.preview, {
      seasonId,
      teamId: userTeamId,
      playerIds: page.map((e) => e.playerId),
      rows: 60,
      partial: false,
    });
    expect(preview.whole).toBe(true);
    expect(preview.leaving.map((p) => p.playerId)).toEqual([gone!.playerId]);

    await commitPage(seasonId, page, { filler: 60 });
    const after = await roster(seasonId);
    const left = after.find((e) => e.playerId === gone!.playerId);
    expect(left?.status).toBe("released");
    expect(after.find((e) => e.playerId === kept!.playerId)?.depthSlot).toBe(1);

    const sync = await owner.query(api.players.rosterSync.latest, { seasonId, teamId: userTeamId });
    expect(sync?.changes).toMatchObject([{ playerId: gone!.playerId, from: "active", to: "released" }]);

    await owner.mutation(api.players.rosterSync.settle, { syncId: sync!._id, undo: [left!._id] });
    expect((await roster(seasonId)).find((e) => e.playerId === gone!.playerId)?.status).toBe("active");
    const settled = await owner.query(api.players.rosterSync.latest, { seasonId, teamId: userTeamId });
    expect(settled?.changes).toEqual([]);
  });

  test("a short or partial page takes nobody off the team", async () => {
    const { season, roster, commitPage } = await setup();
    const seasonId = season(FIRST);
    const before = await roster(seasonId);
    await commitPage(seasonId, before.slice(0, 3));
    await commitPage(seasonId, before.slice(0, 3), { filler: 60, partial: true });
    expect((await roster(seasonId)).filter((e) => e.status === "released")).toEqual([]);
  });

  test("a player it lists comes back, and leaves any other team he was on", async () => {
    const { t, owner, season, roster, commitPage, otherTeam, userTeamId } = await setup();
    const seasonId = season(FIRST);
    const [released, elsewhere] = await roster(seasonId);
    let otherEntry: Id<"rosterEntries">;
    await t.run(async (ctx) => {
      await ctx.db.patch("rosterEntries", released!._id, { status: "released", statusWeekKey: "w3" });
      const { _id, _creationTime, ...fields } = elsewhere!;
      otherEntry = await ctx.db.insert("rosterEntries", { ...fields, teamId: otherTeam._id });
    });
    await commitPage(seasonId, [released!, elsewhere!]);
    const back = (await roster(seasonId)).find((e) => e._id === released!._id);
    expect(back?.status).toBe("active");
    expect(back?.statusWeekKey).toBeUndefined();
    const other = await t.run((ctx) => ctx.db.get("rosterEntries", otherEntry));
    expect(other?.status).toBe("traded");

    const sync = await owner.query(api.players.rosterSync.latest, { seasonId, teamId: userTeamId });
    expect(sync?.changes.map((c) => c.to).sort()).toEqual(["active", "traded"]);
  });

  test("names a player for this season", async () => {
    const { t, season, roster, commitPage } = await setup();
    const next = season(FIRST + 1);
    const [entry] = await roster(season(FIRST));
    await commitPage(next, [entry!]);
    expect((await t.run((ctx) => ctx.db.get("players", entry!.playerId)))?.lastSeenYear).toBe(FIRST + 1);
  });
});

describe("depth chart", () => {
  test("reorders one position, and refuses a mix", async () => {
    const { owner, season, roster, userTeamId } = await setup();
    const seasonId = season(FIRST);
    const entries = await roster(seasonId);
    const position = entries.find(
      (e) => entries.filter((x) => x.position === e.position).length > 1,
    )!.position;
    const same = entries.filter((e) => e.position === position);
    const ids = same.map((e) => e._id).reverse();
    await owner.mutation(api.players.depth.reorder, { entryIds: ids });
    const after = await roster(seasonId, userTeamId);
    expect(after.find((e) => e._id === ids[0])?.depthSlot).toBe(1);
    const other = entries.find((e) => e.position !== position)!;
    await expect(
      owner.mutation(api.players.depth.reorder, { entryIds: [ids[0]!, other._id] }),
    ).rejects.toThrow(/one position/);
  });
});

test("the roster diff compares two seasons", async () => {
  const { t, owner, season, roster, nextSeason, userTeamId } = await setup();
  const from = season(FIRST);
  const [leaving, improving] = await roster(from);
  const next = await nextSeason();
  const carried = await roster(next);
  const entryOf = (playerId: Id<"players">) => carried.find((e) => e.playerId === playerId)!._id;
  await t.run(async (ctx) => {
    await ctx.db.delete("rosterEntries", entryOf(leaving!.playerId));
    await ctx.db.patch("rosterEntries", improving!._id, { ovr: 70 });
    await ctx.db.patch("rosterEntries", entryOf(improving!.playerId), { ovr: 74 });
  });
  const diff = await owner.query(api.players.rosterDiff.between, {
    teamId: userTeamId,
    fromSeasonId: from,
    toSeasonId: next,
  });
  expect(diff.departures.map((r) => r.playerId)).toEqual([leaving!.playerId]);
  expect(diff.changes).toMatchObject([{ delta: 4, after: { playerId: improving!.playerId } }]);
});
