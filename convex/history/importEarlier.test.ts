/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NFLVERSE_URLS } from "../../shared/history/nflverse";
import { NFLVERSE_ERA_SAMPLE } from "../../shared/history/nflverseEraSample";
import { NFLVERSE_SAMPLE } from "../../shared/history/nflverseSample";
import { api, internal } from "../_generated/api";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

/** Rows after the header of a CSV text. */
const body = (csv: string) => csv.slice(csv.indexOf("\n") + 1);
const STATS_HEADER = "player_id,recent_team,position,games\n";

/** nflverse as it was when coverage started in 2002: here, only the 2024 and 2025 sample. */
const BEFORE: Record<string, string> = {
  [NFLVERSE_URLS.standings]: NFLVERSE_SAMPLE.standings,
  [NFLVERSE_URLS.games]: NFLVERSE_SAMPLE.playoffGames,
  [NFLVERSE_URLS.players]: NFLVERSE_SAMPLE.players,
  [NFLVERSE_URLS.draftPicks]: NFLVERSE_SAMPLE.draftPicks,
  [NFLVERSE_URLS.roster(2026)]: NFLVERSE_SAMPLE.roster2026,
  [NFLVERSE_URLS.seasonStats(2024, "regular")]: NFLVERSE_SAMPLE.seasonStats[2024].regular,
  [NFLVERSE_URLS.seasonStats(2025, "regular")]: NFLVERSE_SAMPLE.seasonStats[2025].regular,
  [NFLVERSE_URLS.seasonStats(2025, "postseason")]: NFLVERSE_SAMPLE.seasonStats[2025].postseason,
};

/** The same files once 1999–2001 are in them. */
const AFTER: Record<string, string> = {
  ...BEFORE,
  [NFLVERSE_URLS.games]: NFLVERSE_ERA_SAMPLE.games + body(NFLVERSE_SAMPLE.playoffGames),
  [NFLVERSE_URLS.players]: NFLVERSE_SAMPLE.players + body(NFLVERSE_ERA_SAMPLE.players),
  [NFLVERSE_URLS.draftPicks]: NFLVERSE_SAMPLE.draftPicks + body(NFLVERSE_ERA_SAMPLE.draftPicks),
  [NFLVERSE_URLS.seasonStats(1999, "regular")]: NFLVERSE_ERA_SAMPLE.seasonStats[1999].regular,
  [NFLVERSE_URLS.seasonStats(2000, "regular")]: STATS_HEADER,
  [NFLVERSE_URLS.seasonStats(2001, "regular")]: NFLVERSE_ERA_SAMPLE.seasonStats[2001].regular,
  [NFLVERSE_URLS.seasonStats(2001, "postseason")]: NFLVERSE_ERA_SAMPLE.seasonStats[2001].postseason,
};

let files = BEFORE;
beforeEach(() => {
  files = BEFORE;
  vi.useFakeTimers();
  vi.stubGlobal("fetch", async (url: string) =>
    url in files ? new Response(files[url]) : new Response("not found", { status: 404 }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A Patriots franchise whose import ran before nflverse coverage reached its earlier seasons. */
async function importedFranchise() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  const owner = await asOwner(t);
  await owner.mutation(api.franchise.setup.create, { name: "Pats", teamAbbr: "NE", startYear: 2026 });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  files = AFTER;
  return { t, owner };
}

const tableSizes = (t: Awaited<ReturnType<typeof importedFranchise>>["t"]) =>
  t.run(async (ctx) => ({
    seasons: (await ctx.db.query("seasons").collect()).length,
    players: (await ctx.db.query("players").collect()).length,
    stats: (await ctx.db.query("seasonPlayerStats").collect()).length,
    standings: (await ctx.db.query("standings").collect()).length,
    picks: (await ctx.db.query("draftPicks").collect()).length,
    roster: (await ctx.db.query("rosterEntries").collect()).length,
  }));

describe("earlier-years import", () => {
  test("adds 1999–2001 with the era's divisions and leaves the imported seasons alone", async () => {
    const { t, owner } = await importedFranchise();
    const before = (await owner.query(api.history.imports.status, {}))!;
    expect(before).toMatchObject({ firstYear: 2024, lastYear: 2025 });
    const sizes = await tableSizes(t);

    await owner.mutation(api.history.imports.importEarlier, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const job = (await owner.query(api.history.imports.status, {}))!;
    expect(job).toMatchObject({ status: "done", run: 2, firstYear: 1999, lastYear: 2025 });
    // Everything before the first imported season (2024 here, 2002 on a real deployment); only
    // 1999–2001 are finished seasons in the files, so only they get standings and stats.
    expect(job.plan).toEqual([
      "seasons:1999-2023",
      "players:1999-2023",
      "stats:1999",
      "stats:2000",
      "stats:2001",
      "draft:1999-2023",
      "careers",
    ]);
    expect(job.counts.seasons).toBe(before.counts.seasons + 3);
    expect(job.counts.rosterEntries).toBe(before.counts.rosterEntries);

    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    expect(active.seasons.map((s) => s.year)).toEqual([1999, 2000, 2001, 2024, 2025, 2026]);
    // 2001 Patriots: 11-5, won the AFC East as the 2 seed and Super Bowl XXXVI.
    const s2001 = active.seasons[2]!;
    expect(s2001.userRecord).toMatchObject({
      w: 11,
      l: 5,
      divisionRank: 1,
      seed: 2,
      playoffResult: "champion",
    });

    const standings = await owner.query(api.league.standings.bySeason, { seasonId: s2001._id });
    expect(standings).toHaveLength(31);
    const row = (abbr: string) => standings.find((s) => s.team.abbr === abbr);
    expect(row("HOU")).toBeUndefined();
    expect(row("SEA")).toMatchObject({ conference: "AFC", division: "West" });
    expect(row("TB")).toMatchObject({ conference: "NFC", division: "Central" });
    expect(row("LAR")).toMatchObject({
      conference: "NFC",
      division: "West",
      seed: 1,
      playoffResult: "sb_loss",
    });
    const s2025 = await owner.query(api.league.standings.bySeason, { seasonId: active.seasons[4]!._id });
    expect(s2025.find((s) => s.team.abbr === "SEA")).toMatchObject({ conference: "NFC", division: "West" });

    const overview = await owner.query(api.league.standings.overview, { includeHistory: true });
    expect(overview.champions.map((c) => [c.year, c.superBowl?.abbr])).toEqual([
      [2025, "SEA"],
      [2024, "PHI"],
      [2001, "NE"],
      [2000, "BAL"],
      [1999, "LAR"],
    ]);

    const small = await t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", "Torrance Small"),
        )
        .unique(),
    );
    expect(small).toMatchObject({ retired: true, isReal: true });
    const page = await owner.query(api.players.player.get, { playerId: small!._id });
    expect(page.seasons.map((s) => [s.year, s.stats.split])).toEqual(
      expect.arrayContaining([
        [1999, "regular"],
        [2001, "regular"],
      ]),
    );

    const after = await tableSizes(t);
    expect(after).toMatchObject({
      seasons: sizes.seasons + 3,
      standings: sizes.standings + 3 * 31,
      picks: sizes.picks + 4,
      roster: sizes.roster,
    });
  });

  test("is refused when nothing earlier is left or a run is going, and a full refresh is idempotent", async () => {
    const { t, owner } = await importedFranchise();
    await owner.mutation(api.history.imports.importEarlier, {});
    await expect(owner.mutation(api.history.imports.importEarlier, {})).rejects.toThrow(/already running/);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(owner.mutation(api.history.imports.importEarlier, {})).rejects.toThrow(/Every season/);

    const sizes = await tableSizes(t);
    await owner.mutation(api.history.imports.refresh, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await owner.query(api.history.imports.status, {})).toMatchObject({
      status: "done",
      firstYear: 1999,
      lastYear: 2025,
    });
    expect(await tableSizes(t)).toEqual(sizes);
  });

  test("runs from the CLI for the active franchise, and needs the owner from the client", async () => {
    const { t } = await importedFranchise();
    await expect(t.mutation(api.history.imports.importEarlier, {})).rejects.toThrow(/Sign in required/);
    expect(await t.mutation(internal.history.importJob.importEarlierYears, {})).toBe("started");
    expect(await t.mutation(internal.history.importJob.importEarlierYears, {})).toBe("running");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.mutation(internal.history.importJob.importEarlierYears, {})).toBe("up_to_date");
  });
});
