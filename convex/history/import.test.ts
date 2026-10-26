/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NFLVERSE_URLS } from "../../shared/history/nflverse";
import { NFLVERSE_SAMPLE } from "../../shared/history/nflverseSample";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

/** nflverse as the sample slice; everything else (ESPN images) is a 404. */
const FILES: Record<string, string> = {
  [NFLVERSE_URLS.standings]: NFLVERSE_SAMPLE.standings,
  [NFLVERSE_URLS.games]: NFLVERSE_SAMPLE.playoffGames,
  [NFLVERSE_URLS.players]: NFLVERSE_SAMPLE.players,
  [NFLVERSE_URLS.draftPicks]: NFLVERSE_SAMPLE.draftPicks,
  [NFLVERSE_URLS.roster(2026)]: NFLVERSE_SAMPLE.roster2026,
  [NFLVERSE_URLS.seasonStats(2024, "regular")]: NFLVERSE_SAMPLE.seasonStats[2024].regular,
  [NFLVERSE_URLS.seasonStats(2025, "regular")]: NFLVERSE_SAMPLE.seasonStats[2025].regular,
  [NFLVERSE_URLS.seasonStats(2025, "postseason")]: NFLVERSE_SAMPLE.seasonStats[2025].postseason,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", async (url: string) =>
    url in FILES ? new Response(FILES[url]) : new Response("not found", { status: 404 }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function newFranchise() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  const owner = await asOwner(t);
  await owner.mutation(api.franchise.setup.create, { name: "Pats", teamAbbr: "NE", startYear: 2026 });
  return { t, owner };
}

describe("real NFL history import", () => {
  test("franchise setup imports every finished season before it, end to end", async () => {
    const { t, owner } = await newFranchise();
    expect(await owner.query(api.history.imports.status, {})).toMatchObject({ status: "running" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const job = (await owner.query(api.history.imports.status, {}))!;
    expect(job).toMatchObject({ status: "done", firstYear: 2024, lastYear: 2025 });
    expect(job.stepsDone).toBe(job.plan.length);
    expect(job.counts).toMatchObject({ seasons: 2, players: 7 });

    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    expect(active.seasons.map((s) => [s.year, s.status])).toEqual([
      [2024, "complete"],
      [2025, "complete"],
      [2026, "upcoming"],
    ]);
    // 2025 Patriots: 14-3, second seed, lost the Super Bowl.
    expect(active.seasons[1]!.userRecord).toMatchObject({ w: 14, l: 3, seed: 2, playoffResult: "sb_loss" });

    const roster = await owner.query(api.players.roster.bySeason, { seasonId: active.seasons[2]!._id });
    const maye = roster.entries.find((e) => e.player.displayName === "Drake Maye")!;
    expect(maye.entry).toMatchObject({ jersey: 10, position: "QB", status: "active" });
    const page = await owner.query(api.players.player.get, { playerId: maye.player._id });
    expect(page.player).toMatchObject({ isReal: true, espnId: 4431452, birthYear: 2002 });
    expect(page.seasons.map((s) => [s.year, s.stats.split, s.stats.source])).toEqual(
      expect.arrayContaining([
        [2024, "regular", "import"],
        [2025, "regular", "import"],
        [2025, "postseason", "import"],
      ]),
    );
    const career = await t.run((ctx) =>
      ctx.db
        .query("careerPlayerStats")
        .withIndex("by_playerId", (q) => q.eq("playerId", maye.player._id))
        .collect(),
    );
    expect(career.find((c) => c.split === "regular")).toMatchObject({ seasons: 2, firstYear: 2024 });
  });

  test("a refresh rewrites the same rows instead of adding more", async () => {
    const { t, owner } = await newFranchise();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const count = () =>
      t.run(async (ctx) => ({
        players: (await ctx.db.query("players").collect()).length,
        stats: (await ctx.db.query("seasonPlayerStats").collect()).length,
        standings: (await ctx.db.query("standings").collect()).length,
        picks: (await ctx.db.query("draftPicks").collect()).length,
        roster: (await ctx.db.query("rosterEntries").collect()).length,
      }));
    const before = await count();
    expect(before.standings).toBe(64);
    await owner.mutation(api.history.imports.refresh, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await count()).toEqual(before);
    expect(await owner.query(api.history.imports.status, {})).toMatchObject({ run: 2, status: "done" });
  });

  test("refresh is refused while a run is going, and a failed step is reported", async () => {
    const { t, owner } = await newFranchise();
    await expect(owner.mutation(api.history.imports.refresh, {})).rejects.toThrow(/already running/);
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await owner.query(api.history.imports.status, {})).toMatchObject({
      status: "failed",
      error: expect.stringMatching(/^seasons: nflverse returned 503/),
    });
    await owner.mutation(api.history.imports.refresh, {});
    expect(await owner.query(api.history.imports.status, {})).toMatchObject({ status: "running", run: 2 });
  });

  test("the sample franchise adopts its captured players and keeps its own roster", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.league.seed.seedTeams, {});
    await t.mutation(internal.dev.fixtures.seedFixtures, {});
    const owner = await asOwner(t);
    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    const first = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!;
    const roster = await owner.query(api.players.roster.bySeason, { seasonId: first._id });
    const diggs = roster.entries.find((e) => e.player.displayName === "Stefon Diggs")!;
    // The import knows Diggs on Washington; the franchise's own roster says New England.
    expect(diggs.entry.ovr).toBe(86);
    expect(diggs.player.nflverseId).toBeDefined();
    const named = await t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", "Stefon Diggs"),
        )
        .collect(),
    );
    expect(named).toHaveLength(1);
  });

  test("signed-out callers cannot read or refresh the import", async () => {
    const { t } = await newFranchise();
    await expect(t.query(api.history.imports.status, {})).rejects.toThrow(/Sign in required/);
    await expect(t.mutation(api.history.imports.refresh, {})).rejects.toThrow(/Sign in required/);
  });
});
