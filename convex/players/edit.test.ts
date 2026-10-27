/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

afterEach(() => {
  delete process.env.OWNER_EMAILS;
});

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const { seasonId, buf, ne } = await t.run(async (ctx) => {
    const seasons = await ctx.db.query("seasons").take(20);
    const teams = await ctx.db.query("teams").take(64);
    return {
      seasonId: seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id,
      buf: teams.find((x) => x.abbr === "BUF")!._id,
      ne: teams.find((x) => x.abbr === "NE")!._id,
    };
  });
  const owner = await asOwner(t);
  const roster = await owner.query(api.players.roster.bySeason, { seasonId });
  const diggs = roster.entries.find((e) => e.player.displayName === "Stefon Diggs")!;
  return { t, owner, seasonId, buf, ne, diggs };
}

const entriesOf = (t: Awaited<ReturnType<typeof seeded>>["t"], playerId: string) =>
  t.run(async (ctx) =>
    (await ctx.db.query("rosterEntries").take(500)).filter((e) => e.playerId === playerId),
  );

describe("players/roster:updateEntry", () => {
  test("saves one field at a time and merges acquisition", async () => {
    const { owner, seasonId, diggs } = await seeded();
    const entryId = diggs.entry._id;
    await owner.mutation(api.players.roster.updateEntry, { entryId, patch: { ovr: 90, jersey: null } });
    await owner.mutation(api.players.roster.updateEntry, {
      entryId,
      patch: { acquisitionDetail: "3 yr deal", contractApy: 22_000_000 },
    });
    const roster = await owner.query(api.players.roster.bySeason, { seasonId });
    const entry = roster.entries.find((e) => e.entry._id === entryId)!.entry;
    expect(entry.ovr).toBe(90);
    expect(entry.jersey).toBeUndefined();
    expect(entry.acquisition).toEqual({ type: "free_agent", year: SAMPLE_START_YEAR, detail: "3 yr deal" });
    // The rest of the contract survives a one-field edit.
    expect(entry.contract).toMatchObject({ apy: 22_000_000, years: 3 });
  });

  test("rejects bad values and a team he is already on", async () => {
    const { owner, seasonId, buf, diggs } = await seeded();
    const entryId = diggs.entry._id;
    await expect(
      owner.mutation(api.players.roster.updateEntry, { entryId, patch: { ovr: 120 } }),
    ).rejects.toThrow(/OVR/);
    await owner.mutation(api.players.move.move, {
      playerId: diggs.player._id,
      seasonId,
      teamId: buf,
      status: "active",
    });
    await expect(
      owner.mutation(api.players.roster.updateEntry, { entryId, patch: {}, teamId: buf }),
    ).rejects.toThrow(/already has a roster entry/);
  });

  test("refuses signed-out and non-owner callers", async () => {
    const { t, diggs } = await seeded();
    const args = { entryId: diggs.entry._id, patch: { ovr: 1 } };
    await expect(t.mutation(api.players.roster.updateEntry, args)).rejects.toThrow(/Sign in required/);
    const stranger = await asStranger(t);
    await expect(stranger.mutation(api.players.roster.updateEntry, args)).rejects.toThrow();
  });
});

describe("players/player:update", () => {
  test("edits bio fields and keeps the old name as an alias", async () => {
    const { owner, diggs } = await seeded();
    const playerId = diggs.player._id;
    await owner.mutation(api.players.player.update, {
      playerId,
      patch: { displayName: "Stef Diggs", heightIn: 72, draft: { year: 2015, round: 5, pick: 146 } },
    });
    const { player } = await owner.query(api.players.player.get, { playerId });
    expect(player).toMatchObject({
      displayName: "Stef Diggs",
      firstName: "Stef",
      heightIn: 72,
      draft: { year: 2015, round: 5, pick: 146 },
    });
    expect(player.aliases).toContain("Stefon Diggs");
    await expect(
      owner.mutation(api.players.player.update, { playerId, patch: { weightLb: 20 } }),
    ).rejects.toThrow(/Weight/);
  });

  test("refuses signed-out callers", async () => {
    const { t, diggs } = await seeded();
    await expect(
      t.mutation(api.players.player.update, { playerId: diggs.player._id, patch: { retired: true } }),
    ).rejects.toThrow(/Sign in required/);
  });
});

describe("players/move:move", () => {
  test("a move to another team marks the old entry traded and carries ratings over", async () => {
    const { t, owner, seasonId, buf, diggs } = await seeded();
    const args = { playerId: diggs.player._id, seasonId, teamId: buf, status: "active" as const };
    const newId = await owner.mutation(api.players.move.move, { ...args, statusWeekKey: "w6" });
    const entries = await entriesOf(t, diggs.player._id);
    const old = entries.find((e) => e._id === diggs.entry._id)!;
    const moved = entries.find((e) => e._id === newId)!;
    expect(old).toMatchObject({ status: "traded", statusWeekKey: "w6" });
    expect(moved).toMatchObject({
      teamId: buf,
      status: "active",
      ovr: diggs.entry.ovr,
      position: "WR",
      acquisition: { type: "trade", year: SAMPLE_START_YEAR },
    });
    // Moving again is idempotent: the same entry, no duplicates.
    expect(await owner.mutation(api.players.move.move, args)).toBe(newId);
    expect(await entriesOf(t, diggs.player._id)).toHaveLength(entries.length);
  });

  test("the same team only changes the status", async () => {
    const { t, owner, seasonId, ne, diggs } = await seeded();
    const id = await owner.mutation(api.players.move.move, {
      playerId: diggs.player._id,
      seasonId,
      teamId: ne,
      status: "ir",
    });
    expect(id).toBe(diggs.entry._id);
    const entries = await entriesOf(t, diggs.player._id);
    expect(entries.find((e) => e._id === id)?.status).toBe("ir");
    await expect(
      owner.mutation(api.players.move.move, {
        playerId: diggs.player._id,
        seasonId,
        teamId: ne,
        status: "traded",
      }),
    ).rejects.toThrow(/Traded/);
  });

  test("refuses signed-out callers", async () => {
    const { t, seasonId, buf, diggs } = await seeded();
    await expect(
      t.mutation(api.players.move.move, {
        playerId: diggs.player._id,
        seasonId,
        teamId: buf,
        status: "active",
      }),
    ).rejects.toThrow(/Sign in required/);
  });
});

describe("players/create:create", () => {
  test("creates a player with a roster entry and anchors his age", async () => {
    const { owner, seasonId, ne } = await seeded();
    const playerId = await owner.mutation(api.players.create.create, {
      displayName: "Created Edge",
      position: "LEDG",
      isReal: false,
      bio: { college: "Nowhere State" },
      entry: {
        seasonId,
        teamId: ne,
        patch: { jersey: 99, ovr: 70, age: 22, acquisitionType: "draft", acquisitionYear: SAMPLE_START_YEAR },
      },
    });
    const page = await owner.query(api.players.player.get, { playerId });
    expect(page.player).toMatchObject({
      displayName: "Created Edge",
      firstName: "Created",
      lastName: "Edge",
      isReal: false,
      college: "Nowhere State",
      ageAnchor: { age: 22, year: SAMPLE_START_YEAR },
    });
    expect(page.history[0]?.entry).toMatchObject({ jersey: 99, ovr: 70, status: "active", position: "LEDG" });
    const roster = await owner.query(api.players.roster.bySeason, { seasonId });
    expect(roster.entries.some((e) => e.player._id === playerId)).toBe(true);
  });

  test("rejects a blank name", async () => {
    const { owner } = await seeded();
    await expect(
      owner.mutation(api.players.create.create, { displayName: "  ", position: "QB", isReal: false }),
    ).rejects.toThrow(/Names/);
  });

  test("refuses signed-out callers", async () => {
    const { t } = await seeded();
    await expect(
      t.mutation(api.players.create.create, { displayName: "X Y", position: "QB", isReal: false }),
    ).rejects.toThrow(/Sign in required/);
  });
});
