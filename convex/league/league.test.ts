/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const season = (year: number) => active.seasons.find((s) => s.year === year)!._id;
  return { t, owner, active, season };
}

describe("league", () => {
  test("a real season's standings, bracket and champions come from the import", async () => {
    const { owner, season } = await setup();
    const rows = await owner.query(api.league.standings.bySeason, { seasonId: season(2025) });
    expect(rows).toHaveLength(32);
    const overview = await owner.query(api.league.standings.overview, { includeHistory: true });
    const real = overview.champions.find((c) => c.year === 2025)!;
    // The sample's real 2025 season: Seattle beat New England in the Super Bowl.
    expect([real.afc?.abbr, real.nfc?.abbr, real.superBowl?.abbr]).toEqual(["NE", "SEA", "SEA"]);
    const franchiseOnly = await owner.query(api.league.standings.overview, { includeHistory: false });
    // Only 2026 has a record so far; 2027 has not started.
    expect(franchiseOnly.table.find((r) => r.team.abbr === "NE")).toMatchObject({ seasons: 1, w: 4, l: 1 });
  });

  test("the user team's row is filled from its season when no standings screen exists", async () => {
    const { owner, season } = await setup();
    const rows = await owner.query(api.league.standings.bySeason, {
      seasonId: season(SAMPLE_START_YEAR + 1),
    });
    expect(rows).toEqual([]);
    const sample = await owner.query(api.league.standings.bySeason, { seasonId: season(SAMPLE_START_YEAR) });
    expect(
      sample.map((r) => [r.team.abbr, r.divisionRank, r.source]).sort((a, b) => Number(a[1]) - Number(b[1])),
    ).toEqual([
      ["NE", 1, "standings"],
      ["BUF", 2, "standings"],
      ["MIA", 3, "standings"],
      ["NYJ", 4, "standings"],
    ]);
  });

  test("a team's history: seasons, head-to-head, players seen and picks", async () => {
    const { owner } = await setup();
    const buf = await owner.query(api.league.teamHistory.get, { teamAbbr: "buf" });
    expect(buf.team.abbr).toBe("BUF");
    expect(buf.seasons.map((s) => s.year)).toEqual([2026, 2025, 2024]);
    expect(buf.headToHead).toMatchObject({
      w: 1,
      l: 0,
      games: [{ year: 2026, weekKey: "w5", us: 34, them: 30 }],
    });
    // The sample's draft file has only New England's picks.
    expect(buf.draftPicks).toEqual([]);
    const ne = await owner.query(api.league.teamHistory.get, { teamAbbr: "NE" });
    expect(ne).toMatchObject({
      isUserTeam: true,
      draftPicks: [{ year: 2025, name: "TreVeyon Henderson" }, { year: 2024 }],
    });
    expect(ne.players.length).toBeGreaterThan(0);
    const stranger = await asStranger(convexTest(schema, modules));
    await expect(stranger.query(api.league.teamHistory.get, { teamAbbr: "BUF" })).rejects.toThrow();
  });
});

describe("awards", () => {
  test("a season's awards and team awards, and a player's cabinet", async () => {
    const { owner, season, t, active } = await setup();
    const seasonId = season(SAMPLE_START_YEAR);
    const maye = (await t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", "Drake Maye"),
        )
        .first(),
    ))!;
    const awardId = await owner.mutation(api.awards.awards.giveTeamAward, {
      seasonId,
      name: " Team MVP ",
      playerId: maye._id,
    });
    const awards = await owner.query(api.awards.awards.bySeason, { seasonId });
    expect(awards.find((a) => a._id === awardId)).toMatchObject({
      scope: "team",
      customName: "Team MVP",
      isUser: true,
    });
    expect(
      awards
        .filter((a) => a.weekKey)
        .map((a) => a.type)
        .sort(),
    ).toEqual(["DPOW", "OPOW", "ROW"]);
    const cabinet = await owner.query(api.awards.awards.forPlayer, { playerId: maye._id });
    expect(cabinet.map((a) => a.customName ?? a.type).sort()).toEqual(["OPOW", "Team MVP"]);
    await owner.mutation(api.awards.awards.remove, { awardId });
    await expect(
      owner.mutation(api.awards.awards.giveTeamAward, { seasonId, name: "", playerId: maye._id }),
    ).rejects.toThrow(/Name the award/);
  });
});

describe("draft", () => {
  test("a real draft with the user team's picks graded after two seasons", async () => {
    const { owner, season } = await setup();
    const draft = await owner.query(api.draft.draft.bySeason, { seasonId: season(2024) });
    const ours = draft.picks.filter((p) => p.isUser);
    expect(ours[0]).toMatchObject({ round: 1, overall: 3, name: "Drake Maye" });
    // 2024 and 2025 are complete: two seasons since the 2024 draft.
    expect(ours[0]!.grade).not.toBeNull();
    // Only one season played since the 2025 draft: too soon to grade.
    const recent = await owner.query(api.draft.draft.bySeason, { seasonId: season(2025) });
    expect(recent.picks.filter((p) => p.isUser).map((p) => [p.name, p.grade])).toEqual([
      ["TreVeyon Henderson", null],
    ]);
    const history = await owner.query(api.draft.draft.history, {});
    expect(history.map((h) => h.year)).toEqual([2025, 2024]);
    await owner.mutation(api.draft.draft.updatePick, { pickId: ours[0]!._id, notes: " The franchise QB " });
    expect(
      (await owner.query(api.draft.draft.bySeason, { seasonId: season(2024) })).picks.find(
        (p) => p._id === ours[0]!._id,
      )?.notes,
    ).toBe("The franchise QB");
  });

  test("a pick carries his OVR and dev trait from the draft's season", async () => {
    const { t, owner, active, season } = await setup();
    const pick = (await owner.query(api.draft.draft.bySeason, { seasonId: season(2025) })).picks.find(
      (p) => p.isUser,
    )!;
    const playerId = pick.player!._id;
    await t.run(async (ctx) => {
      const entries = await ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", season(2025)))
        .take(5);
      for (const e of entries) await ctx.db.delete("rosterEntries", e._id);
      await ctx.db.insert("rosterEntries", {
        franchiseId: active.franchise._id,
        seasonId: season(2025),
        teamId: active.franchise.userTeamId,
        playerId,
        position: "HB",
        ovr: 74,
        devTrait: "hidden",
        status: "active",
      });
    });
    const after = (await owner.query(api.draft.draft.bySeason, { seasonId: season(2025) })).picks.find(
      (p) => p._id === pick._id,
    );
    expect(after?.rating).toEqual({ ovr: 74, devTrait: "hidden" });
  });

  test("the pick inventory records picks to and from the user team only", async () => {
    const { owner } = await setup();
    const before = await owner.query(api.draft.inventory.list, {});
    expect(before.years).toEqual([2027, 2028, 2029]);
    expect(before.acquired.map((p) => [p.year, p.round, p.origin.abbr])).toEqual([[2027, 3, "BUF"]]);
    expect(before.traded.map((p) => [p.year, p.round, p.owner.abbr])).toEqual([[2027, 5, "MIA"]]);
    const id = await owner.mutation(api.draft.inventory.add, {
      year: 2028,
      round: 1,
      originAbbr: "NE",
      ownerAbbr: "KC",
    });
    expect((await owner.query(api.draft.inventory.list, {})).traded).toHaveLength(2);
    await owner.mutation(api.draft.inventory.remove, { id });
    await expect(
      owner.mutation(api.draft.inventory.add, { year: 2028, round: 1, originAbbr: "KC", ownerAbbr: "BUF" }),
    ).rejects.toThrow(/Only picks to or from your team/);
    await expect(
      owner.mutation(api.draft.inventory.add, { year: 2028, round: 8, originAbbr: "KC", ownerAbbr: "NE" }),
    ).rejects.toThrow(/Rounds run/);
  });

  test("the draft board: needs from the season before, prospects in order, who was taken", async () => {
    const { owner, season } = await setup();
    await owner.mutation(api.seasons.needs.add, {
      seasonId: season(SAMPLE_START_YEAR),
      position: "CB",
      priority: "high",
    });
    const a = await owner.mutation(api.draft.board.addProspect, {
      year: 2027,
      name: "Lockdown Corner",
      position: "CB",
    });
    const b = await owner.mutation(api.draft.board.addProspect, {
      year: 2027,
      name: "Edge Rusher",
      position: "LEDG",
      college: "Texas",
    });
    await owner.mutation(api.draft.board.moveProspect, { id: b, direction: -1 });
    const board = await owner.query(api.draft.board.get, { year: 2027 });
    expect(board.needs).toMatchObject([{ position: "CB", priority: "high", open: true }]);
    expect(board.prospects.map((p) => p.name)).toEqual(["Edge Rusher", "Lockdown Corner"]);
    await owner.mutation(api.draft.board.removeProspect, { id: a });
    const taken = await owner.query(api.draft.board.get, { year: 2025 });
    expect(taken.taken).toMatchObject([{ round: 2, overall: 38, name: "TreVeyon Henderson" }]);
  });
});

describe("transactions and the cap", () => {
  test("moves in week order with trade notes, the injury report, and the cap against contracts", async () => {
    const { owner, season } = await setup();
    const seasonId = season(SAMPLE_START_YEAR);
    const moves = await owner.query(api.transactions.transactions.bySeason, { seasonId });
    expect(moves.map((m) => [m.type, m.weekKey ?? null])).toEqual([
      ["sign", null],
      ["trade", "w4"],
    ]);
    const trade = moves[1]!;
    expect(trade).toMatchObject({
      counterpart: { abbr: "MIA" },
      picksOut: [{ year: 2027, round: 5 }],
      isUser: true,
    });
    await owner.mutation(api.transactions.transactions.setRetrospective, {
      transactionId: trade._id,
      text: " Worth it ",
    });
    expect((await owner.query(api.transactions.transactions.bySeason, { seasonId }))[1]!.retrospective).toBe(
      "Worth it",
    );

    const injuries = await owner.query(api.transactions.transactions.injuries, { seasonId });
    expect(injuries).toMatchObject([
      { weekKey: "w5", player: { name: "Hunter Henry" }, injuryType: "High ankle sprain" },
    ]);
    const roster = await owner.query(api.players.roster.bySeason, { seasonId });
    expect(roster.entries.find((e) => e.player.displayName === "Hunter Henry")?.injury).toMatchObject({
      onIr: false,
    });

    const cap = await owner.query(api.players.cap.bySeason, { seasonId });
    expect(cap).toMatchObject({
      year: 2026,
      salaryCap: 279_200_000,
      committed: 55_100_000,
      space: 224_100_000,
    });
    expect(cap.players[0]).toMatchObject({ displayName: "Stefon Diggs", apy: 22_500_000, expiring: false });
    expect(
      cap.players
        .filter((p) => p.expiring)
        .map((p) => p.displayName)
        .sort(),
    ).toEqual(["Christian Gonzalez", "Hunter Henry"]);
    await owner.mutation(api.players.cap.setSalaryCap, { seasonId, salaryCap: null });
    expect((await owner.query(api.players.cap.bySeason, { seasonId })).space).toBeNull();
    await expect(owner.mutation(api.players.cap.setSalaryCap, { seasonId, salaryCap: 12 })).rejects.toThrow(
      /between/,
    );
  });

  test("a player's moves and injuries", async () => {
    const { owner, t, active } = await setup();
    const henry = (await t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", "Hunter Henry"),
        )
        .first(),
    ))!;
    const activity = await owner.query(api.players.activity.forPlayer, { playerId: henry._id });
    expect(activity.injuries).toMatchObject([{ year: 2026, injuryType: "High ankle sprain" }]);
    expect(activity.transactions).toEqual([]);
  });
});
