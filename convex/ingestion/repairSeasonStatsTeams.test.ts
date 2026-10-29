/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const fid = active.franchise._id;
  const ne = active.franchise.userTeamId;
  const team = (abbr: string) =>
    t.run(
      async (ctx) =>
        (await ctx.db
          .query("teams")
          .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
          .first())!._id,
    );
  /** What the old season stats commit did with a row that printed no team: filed it under ours. */
  const misfile = (playerId: Id<"players">) =>
    t.run(async (ctx) => {
      await ctx.db.insert("rosterEntries", {
        franchiseId: fid,
        seasonId,
        teamId: ne,
        playerId,
        position: "WR",
        status: "active",
      });
      await ctx.db.insert("reportedSeasonStats", {
        franchiseId: fid,
        seasonId,
        playerId,
        teamId: ne,
        gamesPlayed: 6,
        stats: { rec: 30 },
      });
    });
  const player = (name: string, extra: { teamId?: Id<"teams"> } = {}) =>
    t.run(async (ctx) => {
      const id = await ctx.db.insert("players", {
        franchiseId: fid,
        firstName: "",
        lastName: name,
        displayName: name,
        position: "WR",
        isReal: true,
        retired: false,
        aliases: [],
      });
      if (extra.teamId) {
        await ctx.db.insert("rosterEntries", {
          franchiseId: fid,
          seasonId,
          teamId: extra.teamId,
          playerId: id,
          position: "WR",
          status: "active",
          partial: true,
        });
      }
      return id;
    });
  const linesFor = (playerId: Id<"players">) =>
    t.run(async (ctx) => ({
      reported: (
        await ctx.db
          .query("reportedSeasonStats")
          .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
          .take(10)
      ).map((r) => r.teamId),
      roster: (
        await ctx.db
          .query("rosterEntries")
          .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
          .take(10)
      ).map((r) => r.teamId),
    }));
  return { t, ne, team, misfile, player, linesFor };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("season stats team repair", () => {
  test("moves misfiled lines to the real team, leaves our own players, and runs once", async () => {
    const { t, ne, team, misfile, player, linesFor } = await setup();
    const buf = await team("BUF");
    const bills = await player("Real Bill", { teamId: buf });
    const nobody = await player("Unknown Guy");
    await misfile(bills);
    await misfile(nobody);

    const dry = await t.mutation(internal.ingestion.repairSeasonStatsTeams.run, { dryRun: true });
    expect(dry.moved).toEqual([{ name: "Real Bill", year: SAMPLE_START_YEAR, to: "BUF" }]);
    expect(dry.unresolved.map((u) => u.name)).toEqual(["Unknown Guy"]);
    // Our real players (with box scores) are never in either list.
    expect([...dry.moved, ...dry.unresolved].some((r) => r.name === "Drake Maye")).toBe(false);
    expect(await linesFor(bills)).toEqual({ reported: [ne], roster: [buf, ne] });

    await t.mutation(internal.ingestion.repairSeasonStatsTeams.run, {
      dryRun: false,
      assign: [{ playerId: nobody, teamAbbr: "mia" }],
    });
    expect(await linesFor(bills)).toEqual({ reported: [buf], roster: [buf] });
    expect(await linesFor(nobody)).toEqual({ reported: [await team("MIA")], roster: [] });

    const again = await t.mutation(internal.ingestion.repairSeasonStatsTeams.run, { dryRun: false });
    expect(again).toEqual({ moved: [], unresolved: [] });
  });

  test("a misread name is merged into the real player and placed on his team", async () => {
    const { t, team, misfile, player, linesFor } = await setup();
    const gb = await team("GB");
    const josh = await player("Josh Jacobs", { teamId: gb });
    const misread = await player("John Jacobs");
    const najee = await player("Najee Harris");
    await misfile(misread);
    await misfile(najee);
    const fixes = [
      { name: "John Jacobs", into: "Josh Jacobs", teamAbbr: "GB" },
      { name: "Najee Harris", teamAbbr: "ind" },
      { name: "Nobody Here", into: "Josh Jacobs", teamAbbr: "GB" },
    ];

    const dry = await t.mutation(internal.ingestion.fixMisreads.run, {
      dryRun: true,
      year: SAMPLE_START_YEAR,
      fixes,
    });
    expect(dry.map((r) => [r.name, r.targets.map((m) => m.teams), r.mode, r.done, r.skipped])).toEqual([
      ["John Jacobs", [["GB"]], "merge", false, null],
      ["Najee Harris", [], "place", false, null],
      ["Nobody Here", [["GB"]], null, false, "0 players named Nobody Here"],
    ]);

    await t.mutation(internal.ingestion.fixMisreads.run, {
      dryRun: false,
      year: SAMPLE_START_YEAR,
      fixes,
    });
    expect(await t.run((ctx) => ctx.db.get("players", misread))).toBeNull();
    expect(await linesFor(josh)).toEqual({ reported: [gb], roster: [gb] });
    const ind = await team("IND");
    expect(await linesFor(najee)).toEqual({ reported: [ind], roster: [ind] });
    const merged = await t.run((ctx) => ctx.db.get("players", josh));
    expect(merged?.aliases).toContain("John Jacobs");
  });

  test("a real player matched by mistake keeps his career; only the season's line moves", async () => {
    vi.useFakeTimers();
    const { t, team, misfile, player, linesFor } = await setup();
    const gb = await team("GB");
    const josh = await player("Josh Jacobs", { teamId: gb });
    // An old player from the history import, there long before the season stats were read.
    const oldJohn = await player("John Jacobs");
    vi.setSystemTime(Date.now() + 60 * 60_000);
    await misfile(oldJohn);
    const fixes = [{ name: "John Jacobs", into: "Josh Jacobs", teamAbbr: "GB" }];

    const [dry] = await t.mutation(internal.ingestion.fixMisreads.run, {
      dryRun: true,
      year: SAMPLE_START_YEAR,
      fixes,
    });
    expect(dry?.mode).toBe("move");
    await t.mutation(internal.ingestion.fixMisreads.run, { dryRun: false, year: SAMPLE_START_YEAR, fixes });
    expect(await t.run((ctx) => ctx.db.get("players", oldJohn))).not.toBeNull();
    expect(await linesFor(oldJohn)).toEqual({ reported: [], roster: [] });
    expect(await linesFor(josh)).toEqual({ reported: [gb], roster: [gb] });
  });
});
