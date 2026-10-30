/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { confirmNew } from "../lib/testDraft";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  return { t, owner, seasonId };
}

describe("season stats", () => {
  test("totals derived from the sample box scores match a hand check", async () => {
    const { owner, seasonId } = await setup();
    const rows = await owner.query(api.stats.season.bySplit, { seasonId, split: "regular" });
    const by = (name: string) => rows.find((r) => r.name === name)!;
    // 284 + 301 + 221 + 342 + 255
    expect(by("Drake Maye")).toMatchObject({
      gamesPlayed: 5,
      source: "logs",
      totals: { passYds: 1403, passTd: 11 },
    });
    expect(by("Drake Maye").thresholdCounts).toMatchObject({ pass300: 2, pass3td: 2 });
    // 88 + 64 + 97 + 121 + 108, best game 121
    expect(by("TreVeyon Henderson")).toMatchObject({
      totals: { rushYds: 478 },
      bestGames: { rushYds: { value: 121 } },
    });
    expect(by("Stefon Diggs").totals.recYds).toBe(531);
    expect(await owner.query(api.stats.season.bySplit, { seasonId, split: "postseason" })).toEqual([]);
  });
});

describe("season screen numbers for missing games", () => {
  test("show where a difference was settled as a missing game, on the stats screen and player page", async () => {
    const { t, owner, seasonId } = await setup();
    const rows = await owner.query(api.stats.season.bySplit, { seasonId, split: "regular" });
    const maye = rows.find((r) => r.name === "Drake Maye")!;
    await t.run(async (ctx) => {
      const season = (await ctx.db.get("seasons", seasonId))!;
      const franchise = (await ctx.db.get("franchises", season.franchiseId))!;
      await ctx.db.insert("reportedSeasonStats", {
        franchiseId: franchise._id,
        seasonId,
        playerId: maye.playerId,
        teamId: franchise.userTeamId,
        gamesPlayed: 6,
        stats: { passYds: 1690, passTd: 12 },
        resolved: { passYds: "missing", passTd: "logs", gamesPlayed: "missing" },
      });
    });

    const after = await owner.query(api.stats.season.bySplit, { seasonId, split: "regular" });
    expect(after.find((r) => r.name === "Drake Maye")).toMatchObject({
      gamesPlayed: 6,
      totals: { passYds: 1690, passTd: 11 },
    });
    expect(after.find((r) => r.name === "Drake Maye")!.overridden.toSorted()).toEqual([
      "gamesPlayed",
      "passYds",
    ]);
    const playoffs = await owner.query(api.stats.season.bySplit, { seasonId, split: "postseason" });
    expect(playoffs.every((r) => r.overridden.length === 0)).toBe(true);

    const page = await owner.query(api.players.player.get, { playerId: maye.playerId });
    const regular = page.seasons.find((s) => s.stats.seasonId === seasonId && s.stats.split === "regular")!;
    expect(regular.stats).toMatchObject({ gamesPlayed: 6, totals: { passYds: 1690, passTd: 11 } });
    expect(regular.overridden.toSorted()).toEqual(["gamesPlayed", "passYds"]);

    // Display only: the stored log totals the reconcile screen compares against are untouched.
    const stored = await t.run((ctx) =>
      ctx.db
        .query("seasonPlayerStats")
        .withIndex("by_playerId_and_seasonId", (q) =>
          q.eq("playerId", maye.playerId).eq("seasonId", seasonId),
        )
        .take(5),
    );
    expect(stored.find((r) => r.split === "regular")).toMatchObject({
      gamesPlayed: 5,
      totals: { passYds: 1403 },
    });
  });
});

/** One list of the franchise-era book. */
async function franchiseList(
  owner: Awaited<ReturnType<typeof setup>>["owner"],
  scope: "game" | "season" | "career",
  category: "passing" | "receiving",
  statKey: string,
) {
  const { lists } = await owner.query(api.stats.records.lists, {
    book: "franchise",
    split: "regular",
    scope,
    category,
  });
  return lists.find((l) => l.statKey === statKey)!;
}

describe("records and leaders", () => {
  test("single game, season and career records with the game they were set in", async () => {
    const { owner } = await setup();
    const passYds = await franchiseList(owner, "game", "passing", "passYds");
    expect(passYds).toMatchObject({ game: { weekKey: "w5", opponentAbbr: "BUF" } });
    expect(passYds.entries[0]).toMatchObject({
      rank: 1,
      value: 342,
      name: "Drake Maye",
      team: { abbr: "NE" },
    });
    const recYds = await franchiseList(owner, "season", "receiving", "recYds");
    expect(recYds.entries[0]).toMatchObject({ value: 531, name: "Stefon Diggs", year: 2026 });
    const leaders = await owner.query(api.stats.records.leaders, { split: "regular" });
    expect(leaders.find((r) => r.statKey === "recYds")!.top.map((e) => [e.player.name, e.value])).toEqual([
      ["Stefon Diggs", 531],
      ["DeMario Douglas", 371],
      ["Hunter Henry", 265],
      ["TreVeyon Henderson", 95],
    ]);
  });

  test("a bigger game breaks the record, keeps the old holder and raises a milestone", async () => {
    const { t, owner, seasonId } = await setup();
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [
        await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(8)], { type: "image/png" }))),
      ],
      source: "web",
      targetKey: "game_box_score",
      seasonId,
      weekKey: "w7",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const draft = (await owner.query(api.ingestion.review.get, { setKey: setKey! })).extraction!.draft;
    if (draft.target !== "game_box_score") throw new Error("wrong target");
    draft.lines.find((l) => l.name === "S. Diggs")!.stats.recYds = 200;
    await owner.mutation(api.ingestion.review.commit, { setKey: setKey!, draft: confirmNew(draft) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const recYds = await franchiseList(owner, "game", "receiving", "recYds");
    expect(recYds).toMatchObject({ game: { weekKey: "w7" }, previous: { name: "Stefon Diggs", value: 148 } });
    expect(recYds.entries[0]).toMatchObject({ value: 200, name: "Stefon Diggs" });
    const feed = await owner.query(api.stats.milestones.feed, {});
    const record = feed.find((m) => m.kind === "franchise_record" && m.title.includes("receiving yards"));
    expect(record?.title).toBe("Stefon Diggs: franchise record, single game receiving yards (200)");
    expect(feed.some((m) => m.title === "Stefon Diggs: career-high 200 receiving yards")).toBe(true);

    // Acknowledging clears it from the feed; a recommit of the same game never duplicates.
    await owner.mutation(api.stats.milestones.acknowledge, { milestoneIds: [record!._id] });
    expect((await owner.query(api.stats.milestones.feed, {})).some((m) => m._id === record!._id)).toBe(false);
  });
});

describe("streaks and milestones", () => {
  test("team and player streaks from the sample season", async () => {
    const { owner } = await setup();
    const { team, players } = await owner.query(api.stats.streaks.all, {});
    // W W L(OT) W W
    expect(team.find((s) => s.key === "wins")).toEqual({ key: "wins", current: 2, longest: 2 });
    const henderson = players.filter((s) => s.player.name === "TreVeyon Henderson");
    expect(henderson.find((s) => s.key === "rush100")).toMatchObject({ current: 2, longest: 2 });
    expect(players.find((s) => s.player.name === "Drake Maye" && s.key === "passTdGames")).toMatchObject({
      current: 5,
    });
  });

  test("threshold games show up in the feed once per game", async () => {
    const { owner } = await setup();
    const feed = await owner.query(api.stats.milestones.feed, {});
    const passing = feed.filter((m) => m.title === "Drake Maye: 300-yard passing game");
    expect(passing).toHaveLength(2);
  });
});

describe("thresholds", () => {
  test("overrides are validated and saved", async () => {
    const { t, owner } = await setup();
    await owner.mutation(api.franchise.settings.setThresholds, {
      overrides: { rushYds: { tier1: 800, tier2: 1200 } },
    });
    const franchise = await t.run((ctx) => ctx.db.query("franchises").first());
    expect(franchise?.settings.thresholdOverrides).toEqual({ rushYds: { tier1: 800, tier2: 1200 } });
    await expect(
      owner.mutation(api.franchise.settings.setThresholds, {
        overrides: { rushYds: { tier1: 800, tier2: 700 } },
      }),
    ).rejects.toThrow(/second tier must be above/);
    await expect(
      owner.mutation(api.franchise.settings.setThresholds, { overrides: { nonsense: { tier1: 1 } } }),
    ).rejects.toThrow(/Unknown stat/);
    // The single-game scale is saved beside the season one and leaves it alone.
    await owner.mutation(api.franchise.settings.setThresholds, {
      scale: "game",
      overrides: { passYds: { tier1: 350, tier2: 450 } },
    });
    const after = await t.run((ctx) => ctx.db.query("franchises").first());
    expect(after?.settings.gameThresholdOverrides).toEqual({ passYds: { tier1: 350, tier2: 450 } });
    expect(after?.settings.thresholdOverrides).toEqual({ rushYds: { tier1: 800, tier2: 1200 } });
  });

  test("strangers are refused", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(
      stranger.query(api.stats.records.lists, {
        book: "team",
        split: "regular",
        scope: "game",
        category: "passing",
      }),
    ).rejects.toThrow(/Not the owner/);
    await expect(stranger.mutation(api.franchise.settings.setThresholds, { overrides: {} })).rejects.toThrow(
      /Not the owner/,
    );
  });
});
