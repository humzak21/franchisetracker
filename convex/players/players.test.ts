/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

afterEach(() => {
  delete process.env.OWNER_EMAILS;
});

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const season = await t.run(async (ctx) => {
    const seasons = await ctx.db.query("seasons").take(20);
    return seasons.find((s) => s.year === SAMPLE_START_YEAR)!;
  });
  return { t, owner: await asOwner(t), seasonId: season._id };
}

describe("players/roster:bySeason", () => {
  test("returns the user team's roster joined to players", async () => {
    const { owner, seasonId } = await seeded();
    const roster = await owner.query(api.players.roster.bySeason, { seasonId });
    expect(roster.team.abbr).toBe("NE");
    expect(roster.entries.length).toBe(8);
    const diggs = roster.entries.find((e) => e.player.displayName === "Stefon Diggs");
    expect(diggs?.entry).toMatchObject({ position: "WR", jersey: 8, ovr: 86 });
  });

  test("refuses signed-out callers", async () => {
    const { t, seasonId } = await seeded();
    await expect(t.query(api.players.roster.bySeason, { seasonId })).rejects.toThrow(/Sign in required/);
  });
});

describe("players/player", () => {
  test("get returns history and season stats with years and teams, imported seasons first", async () => {
    const { owner, seasonId } = await seeded();
    const roster = await owner.query(api.players.roster.bySeason, { seasonId });
    const maye = roster.entries.find((e) => e.player.displayName === "Drake Maye")!;
    const page = await owner.query(api.players.player.get, { playerId: maye.player._id });
    expect(page.history).toHaveLength(1);
    expect(page.history[0]).toMatchObject({ year: SAMPLE_START_YEAR, team: { abbr: "NE" } });
    expect(page.seasons.find((s) => s.year === SAMPLE_START_YEAR)?.stats).toMatchObject({
      source: "logs",
      gamesPlayed: 5,
      totals: { passYds: 1403 },
    });
    expect(page.seasons[0]).toMatchObject({ year: 2024, team: { abbr: "NE" }, stats: { source: "import" } });
  });

  test("updateNotes saves and clears notes", async () => {
    const { owner, seasonId } = await seeded();
    const roster = await owner.query(api.players.roster.bySeason, { seasonId });
    const playerId = roster.entries[0]!.player._id;
    await owner.mutation(api.players.player.updateNotes, { playerId, notes: "QB of the future." });
    expect((await owner.query(api.players.player.get, { playerId })).player.notes).toBe("QB of the future.");
    await owner.mutation(api.players.player.updateNotes, { playerId, notes: "  " });
    expect((await owner.query(api.players.player.get, { playerId })).player.notes).toBeUndefined();
  });

  test("refuses signed-out callers", async () => {
    const { t, owner, seasonId } = await seeded();
    const roster = await owner.query(api.players.roster.bySeason, { seasonId });
    const playerId = roster.entries[0]!.player._id;
    await expect(t.query(api.players.player.get, { playerId })).rejects.toThrow(/Sign in required/);
    await expect(t.mutation(api.players.player.updateNotes, { playerId, notes: "x" })).rejects.toThrow(
      /Sign in required/,
    );
  });
});
