/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { RowTargetKey } from "../../shared/ingestion/rows/targets";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import schema from "../schema";
import { asOwner } from "../lib/testOwner";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const image = () =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })));
  /** Uploads, extracts (two shots, merged), accepts every row and commits. */
  const commit = async (targetKey: RowTargetKey, weekKey?: "w6") => {
    const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [await image(), await image()],
      source: "web",
      targetKey,
      seasonId,
      weekKey,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const review = await owner.query(api.ingestion.review.get, { setKey: setKey! });
    const draft = review.extraction!.draft;
    if (!("rows" in draft)) throw new Error("not a row draft");
    const accepted = { ...draft, rows: draft.rows.map((r) => ({ ...r, accepted: true })) };
    const result = await owner.mutation(api.ingestion.review.commit, { setKey: setKey!, draft: accepted });
    return { setKey: setKey!, draft, result };
  };
  return { t, owner, active, seasonId, commit };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

const playerNamed = (
  t: Awaited<ReturnType<typeof setup>>["t"],
  franchiseId: Id<"franchises">,
  name: string,
) =>
  t.run((ctx) =>
    ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_displayName", (q) =>
        q.eq("franchiseId", franchiseId).eq("displayName", name),
      )
      .first(),
  );

describe("row targets", () => {
  test("a season screen needs only a season; shots merge into one draft with names resolved", async () => {
    const { owner, commit } = await setup();
    const { draft } = await commit("standings");
    expect(draft.rows.map((r) => r.teamAbbr)).toEqual(["NE", "BUF", "MIA", "NYJ"]);
    // The unsure row starts unaccepted.
    expect(draft.rows.map((r) => r.accepted)).toEqual([true, true, true, false]);
    const leaders = await commit("league_leaders");
    expect(leaders.draft.rows.find((r) => r.name === "D. Maye")?.match?.status).toBe("matched");
    expect((await owner.query(api.ingestion.inbox.list, {})).every((s) => s.status === "committed")).toBe(
      true,
    );
  });

  test("standings land per team and put the user team's division finish and seed on the season", async () => {
    const { t, commit, seasonId } = await setup();
    await commit("standings");
    await commit("standings");
    const rows = await t.run((ctx) =>
      ctx.db
        .query("standings")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );
    expect(rows).toHaveLength(4);
    const season = await t.run((ctx) => ctx.db.get("seasons", seasonId));
    expect(season?.userRecord).toMatchObject({ w: 4, l: 1, divisionRank: 1, seed: 2 });
  });

  test("leaders replace the board; team season stats upsert per stat", async () => {
    const { t, commit, seasonId, active } = await setup();
    await commit("league_leaders");
    await commit("league_leaders");
    const board = await t.run((ctx) =>
      ctx.db
        .query("leagueLeaders")
        .withIndex("by_seasonId_and_statKey_and_rank", (q) =>
          q.eq("seasonId", seasonId).eq("statKey", "passYds"),
        )
        .collect(),
    );
    expect(board.map((r) => [r.rank, r.rawName, r.value])).toEqual([
      [1, "J. Allen", 1620],
      [2, "D. Maye", 1450],
      [3, "P. Mahomes", 1398],
    ]);
    expect(board[1]!.playerId).toBe((await playerNamed(t, active.franchise._id, "Drake Maye"))!._id);
    await commit("team_season_stats");
    const stats = await t.run((ctx) =>
      ctx.db
        .query("teamSeasonStats")
        .withIndex("by_seasonId_and_teamId_and_statKey", (q) =>
          q.eq("seasonId", seasonId).eq("teamId", active.franchise.userTeamId),
        )
        .collect(),
    );
    // The sample already ranks six stats; the capture replaces three of them in place.
    expect(stats).toHaveLength(6);
    const captured = ["pointsAllowedPg", "pointsPg", "yardsPg"];
    expect(
      stats.filter((s) => captured.includes(s.statKey)).map((s) => [s.statKey, s.value, s.rank, s.tied]),
    ).toEqual([
      ["pointsAllowedPg", 21.6, 12, true],
      ["pointsPg", 28, 3, false],
      ["yardsPg", 371.4, 6, false],
    ]);
  });

  test("league team stats merge every tab into one row per team, read back for all teams", async () => {
    const { commit, owner, seasonId } = await setup();
    const { draft } = await commit("league_team_stats");
    if (!("rows" in draft)) throw new Error("not a row draft");
    expect(draft.rows.map((r) => r.teamAbbr)).toEqual(["CIN", "BUF", "NE"]);
    const teams = await owner.query(api.league.teamStats.leagueBySeason, { seasonId });
    // The sample seeds the AFC East; the capture adds Cincinnati and replaces what it read.
    expect(teams.map((r) => r.team.abbr).sort()).toEqual(["BUF", "CIN", "MIA", "NE", "NYJ"]);
    const ne = teams.find((r) => r.team.abbr === "NE")!;
    expect(ne).toMatchObject({ isUser: true, games: 5 });
    expect(ne.stats).toMatchObject({ passYds: 4454, intThrown: 15, redZoneAtt: 84, thirdDownAtt: 130 });
    // Buffalo's capture read offense and defense only: its seeded conversions stay.
    const buf = teams.find((r) => r.team.abbr === "BUF")!;
    expect([buf.stats.passYds, buf.stats.thirdDownAtt]).toEqual([4605, 60]);
    const cin = teams.find((r) => r.team.abbr === "CIN")!;
    expect(cin.stats).toEqual({
      totalYds: 6824,
      passYds: 5590,
      rushYds: 846,
      pointsPg: 26.9,
      passTd: 42,
      rushTd: 12,
      firstDowns: 273,
    });
  });

  test("season stats reconcile against the logs, and differences can be settled", async () => {
    const { owner, commit, seasonId, t, active } = await setup();
    const { result } = await commit("season_player_stats");
    expect(result.gameId).toBeUndefined();
    const view = await owner.query(api.stats.reconcile.get, { seasonId });
    expect(view.reportedPlayers).toBe(3);
    const maye = view.differences.find((d) => d.player.displayName === "Drake Maye" && d.stat === "passYds")!;
    expect(maye).toMatchObject({ reported: 1450, logs: 1403, delta: 47, resolution: null });
    // Five games captured, six reported: a game is missing somewhere.
    expect(view.differences.some((d) => d.stat === "gamesPlayed" && d.delta === 1)).toBe(true);
    await owner.mutation(api.stats.reconcile.resolve, {
      seasonId,
      items: [{ playerId: maye.playerId, stat: "passYds" }],
      resolution: "logs",
    });
    const after = await owner.query(api.stats.reconcile.get, { seasonId });
    expect(
      after.differences.find((d) => d.playerId === maye.playerId && d.stat === "passYds")?.resolution,
    ).toBe("logs");
    // Everything else at once, then all of it reopened at once.
    const rest = after.differences
      .filter((d) => d.resolution === null)
      .map((d) => ({ playerId: d.playerId, stat: d.stat }));
    await owner.mutation(api.stats.reconcile.resolve, { seasonId, items: rest, resolution: "missing" });
    const all = await owner.query(api.stats.reconcile.get, { seasonId });
    expect(all.differences.filter((d) => d.resolution === null)).toEqual([]);
    await owner.mutation(api.stats.reconcile.resolve, { seasonId, items: rest, resolution: null });
    const back = await owner.query(api.stats.reconcile.get, { seasonId });
    expect(back.differences.filter((d) => d.resolution === null)).toHaveLength(rest.length);
    // Reading the same numbers again keeps the settlement; a changed number reopens it.
    await commit("season_player_stats");
    const kept = await owner.query(api.stats.reconcile.get, { seasonId });
    expect(
      kept.differences.find((d) => d.playerId === maye.playerId && d.stat === "passYds")?.resolution,
    ).toBe("logs");
    await t.run(async (ctx) => {
      const row = (
        await ctx.db
          .query("reportedSeasonStats")
          .withIndex("by_playerId_and_seasonId", (q) =>
            q.eq("playerId", maye.playerId).eq("seasonId", seasonId),
          )
          .take(1)
      )[0]!;
      expect(row.teamId).toBe(active.franchise.userTeamId);
      await ctx.db.patch("reportedSeasonStats", row._id, { stats: { ...row.stats, passYds: 1000 } });
    });
    await commit("season_player_stats");
    const reopened = await owner.query(api.stats.reconcile.get, { seasonId });
    expect(
      reopened.differences.find((d) => d.playerId === maye.playerId && d.stat === "passYds")?.resolution,
    ).toBeNull();
  });

  test("awards, the draft, roster pages, transactions, injuries and a player card", async () => {
    const { t, commit, seasonId, active } = await setup();
    const fid = active.franchise._id;
    await commit("weekly_awards", "w6");
    await commit("weekly_awards", "w6");
    await commit("yearly_awards");
    await commit("yearly_awards");
    const awards = await t.run((ctx) =>
      ctx.db
        .query("awards")
        .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );
    // Only the screenshot's awards; the sample season's own have no printed name.
    expect(
      awards
        .filter((a) => a.rawName)
        .map((a) => [a.type, a.weekKey ?? null, a.rawName])
        .sort(),
    ).toEqual([
      ["AllPro1", null, "C. Gonzalez"],
      ["DPOW", "w6", "M. Parsons"],
      ["MVP", null, "D. Maye"],
      ["OPOW", "w6", "D. Maye"],
    ]);

    await commit("draft_results");
    const rookie = (await playerNamed(t, fid, "Rookie Corner"))!;
    expect(rookie).toMatchObject({
      position: "CB",
      college: "Georgia",
      draft: { year: SAMPLE_START_YEAR, round: 1, pick: 28 },
    });

    await commit("roster_page");
    const maye = (await playerNamed(t, fid, "Drake Maye"))!;
    const entries = await t.run((ctx) =>
      ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", maye._id).eq("seasonId", seasonId))
        .collect(),
    );
    expect(entries).toMatchObject([{ ovr: 81, jersey: 10, devTrait: "star" }]);

    await commit("transactions");
    await commit("transactions");
    const moves = await t.run((ctx) =>
      ctx.db
        .query("transactions")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );
    expect(moves.filter((m) => m.weekKey === "w6")).toMatchObject([{ type: "sign", notes: "1 yr, $2.5M" }]);

    await commit("injury_report", "w6");
    const henry = (await playerNamed(t, fid, "Hunter Henry"))!;
    const injuries = await t.run((ctx) =>
      ctx.db
        .query("injuries")
        .withIndex("by_playerId", (q) => q.eq("playerId", henry._id))
        .collect(),
    );
    expect(injuries.filter((i) => i.weekKey === "w6")).toMatchObject([
      { injuryType: "Ankle sprain", lengthWeeks: 3, onIr: false },
    ]);

    const { result } = await commit("player_card");
    expect(result.playerId).toBe(maye._id);
    const card = await t.run((ctx) =>
      ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", maye._id).eq("seasonId", seasonId))
        .first(),
    );
    expect(card).toMatchObject({
      ovr: 82,
      abilities: ["Bazooka", "Pocket Deadeye"],
      contract: { years: 3, apy: 9_200_000, total: 27_600_000, expiresYear: 2028 },
    });
  });

  test("a weekly screen waits for a week before it extracts", async () => {
    const { t, owner, seasonId } = await setup();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(8)], { type: "image/png" })),
    );
    await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [storageId],
      source: "web",
      targetKey: "injury_report",
      seasonId,
    });
    expect((await owner.query(api.ingestion.inbox.list, {}))[0]?.status).toBe("queued");
  });
});
