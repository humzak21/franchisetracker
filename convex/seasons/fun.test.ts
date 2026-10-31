/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
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
  const franchiseId = active.franchise._id;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const player = async (lastName: string) =>
    await t.run(async (ctx) => {
      const found = await ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_lastName", (q) =>
          q.eq("franchiseId", franchiseId).eq("lastName", lastName),
        )
        .first();
      return found!._id;
    });
  const team = async (abbr: string) =>
    await t.run(async (ctx) => {
      const found = await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
        .unique();
      return found!._id;
    });
  return { t, owner, active, franchiseId, seasonId, player, team };
}

describe("the weekly digest", () => {
  test("the latest game: result, record, stars and streak", async () => {
    const { owner, seasonId } = await setup();
    const digest = (await owner.query(api.dashboard.digest.latest, { seasonId }))!;
    expect(digest).toMatchObject({
      weekKey: "w6",
      result: "W",
      us: 28,
      them: 14,
      home: true,
      opponentName: "Saints",
      teamName: "Patriots",
      record: { w: 4, l: 1, t: 0 },
      streak: "W2",
      division: "AFC East",
    });
  });

  test("records lead, then the rest of what the game raised", async () => {
    const { t, owner, seasonId, franchiseId } = await setup();
    const digest = (await owner.query(api.dashboard.digest.latest, { seasonId }))!;
    await t.run(async (ctx) => {
      const milestone = (kind: "team_record" | "first_td", title: string) => ({
        franchiseId,
        seasonId,
        key: title,
        kind,
        gameId: digest.gameId,
        title,
        acknowledged: true,
        detectedAt: 1,
      });
      await ctx.db.insert("milestones", milestone("first_td", "A first touchdown"));
      await ctx.db.insert("milestones", milestone("team_record", "Most points in a game"));
    });
    const after = (await owner.query(api.dashboard.digest.latest, { seasonId }))!;
    expect(after.records).toEqual(["Most points in a game"]);
    expect(after.milestones).toContain("A first touchdown");
  });

  test("a season with no result has no digest", async () => {
    const { t, owner, franchiseId } = await setup();
    const empty = await t.run((ctx) =>
      ctx.db.insert("seasons", { franchiseId, year: 2090, status: "upcoming" }),
    );
    expect(await owner.query(api.dashboard.digest.latest, { seasonId: empty })).toBeNull();
  });

  test("strangers are turned away", async () => {
    const { t, seasonId } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.dashboard.digest.latest, { seasonId })).rejects.toThrow();
  });
});

describe("a season's recap", () => {
  test("tells the record, the weeks and the leaders", async () => {
    const { owner } = await setup();
    const recap = (await owner.query(api.seasons.recap.get, { year: SAMPLE_START_YEAR }))!;
    expect(recap.headline).toContain("4-1");
    expect(recap.weeks).toHaveLength(5);
    expect(recap.highs).toMatchObject({
      bestWin: { weekKey: "w1", us: 31, them: 17, opponentAbbr: "LV" },
      worstLoss: { weekKey: "w3", opponentAbbr: "PIT" },
      longestWin: 2,
      longestLoss: 1,
    });
    expect(recap.leaders.map((l) => l.stat)).toContain("passYds");
  });

  test("gathers only the user team's awards, moves and picks", async () => {
    const { t, owner, franchiseId, seasonId, player, team } = await setup();
    const maye = await player("Maye");
    const [own, other] = [await team("NE"), await team("BUF")];
    const before = (await owner.query(api.seasons.recap.get, { year: SAMPLE_START_YEAR }))!;
    await t.run(async (ctx) => {
      const award = { franchiseId, seasonId, scope: "league" as const };
      await ctx.db.insert("awards", { ...award, type: "MVP", playerId: maye, teamId: own });
      await ctx.db.insert("awards", { ...award, type: "OPOY", rawName: "Someone", teamId: other });
      const move = { franchiseId, seasonId, playersIn: [], picksIn: [], picksOut: [] };
      await ctx.db.insert("transactions", {
        ...move,
        type: "trade",
        teamId: own,
        playersOut: [{ playerId: maye }],
      });
      await ctx.db.insert("transactions", { ...move, type: "trade", teamId: other, playersOut: [] });
      await ctx.db.insert("transactions", { ...move, type: "ir", teamId: own, playersOut: [] });
      const pick = { franchiseId, seasonId, round: 1 };
      await ctx.db.insert("draftPicks", { ...pick, overall: 12, teamId: own, rawName: "Our Pick" });
      await ctx.db.insert("draftPicks", { ...pick, overall: 13, teamId: other, rawName: "Their Pick" });
    });
    const recap = (await owner.query(api.seasons.recap.get, { year: SAMPLE_START_YEAR }))!;
    expect(recap.awards.map((a) => a.label)).toContain("Most Valuable Player");
    expect(recap.awards.map((a) => a.label)).not.toContain("Offensive Player of the Year");
    expect(recap.moves.total).toBe(before.moves.total + 1);
    expect(recap.moves.rows.map((m) => m.label).join()).toContain("Drake Maye");
    expect(recap.draft.map((d) => d.label)).toEqual(["Rd 1, #12 · Our Pick"]);
  });

  test("the report's words come along, without the blanks", async () => {
    const { owner, seasonId } = await setup();
    await owner.mutation(api.seasons.reports.saveText, {
      seasonId,
      field: "postseasonThoughts",
      text: "  A year to remember.  ",
    });
    const recap = (await owner.query(api.seasons.recap.get, { year: SAMPLE_START_YEAR }))!;
    expect(recap.words.postseason).toBe("A year to remember.");
    expect(recap.words.aroundTheLeague).toBeUndefined();
  });

  test("real seasons before the franchise and missing ones have none", async () => {
    const { owner } = await setup();
    expect(await owner.query(api.seasons.recap.get, { year: SAMPLE_START_YEAR - 1 })).toBeNull();
    expect(await owner.query(api.seasons.recap.get, { year: 2090 })).toBeNull();
  });
});

describe("a rivalry", () => {
  test("every meeting, the highs and our best against them", async () => {
    const { owner } = await setup();
    const rivalry = await owner.query(api.league.rivals.get, { teamAbbr: "pit" });
    expect(rivalry.opponent.abbr).toBe("PIT");
    expect(rivalry.record).toEqual({ w: 0, l: 1, t: 0 });
    expect(rivalry.streak).toBe("L1");
    expect(rivalry.games).toHaveLength(1);
    expect(rivalry.highs).toMatchObject({ bestWin: null, worstLoss: { us: 20, them: 23 }, longestLoss: 1 });
    expect(rivalry.performers.map((p) => p.stat)).toContain("passYds");
  });

  test("a team never met has an empty page", async () => {
    const { owner } = await setup();
    const rivalry = await owner.query(api.league.rivals.get, { teamAbbr: "SEA" });
    expect(rivalry).toMatchObject({ games: [], streak: null, performers: [] });
  });

  test("an unknown team is refused", async () => {
    const { owner } = await setup();
    await expect(owner.query(api.league.rivals.get, { teamAbbr: "XXX" })).rejects.toThrow();
  });
});

describe("the awards race", () => {
  test("our logs and the league's lines race together", async () => {
    const { t, owner, franchiseId, seasonId, team } = await setup();
    const buf = await team("BUF");
    const rival = await t.run(async (ctx) => {
      const playerId = await ctx.db.insert("players", {
        franchiseId,
        firstName: "Rival",
        lastName: "Back",
        displayName: "Rival Back",
        position: "HB",
        isReal: true,
        retired: false,
        aliases: [],
      });
      await ctx.db.insert("reportedSeasonStats", {
        franchiseId,
        seasonId,
        playerId,
        teamId: buf,
        gamesPlayed: 6,
        stats: { rushYds: 9000 },
      });
      return playerId;
    });
    const race = await owner.query(api.awards.race.bySeason, { seasonId });
    const opoy = race.find((r) => r.type === "OPOY")!;
    expect(opoy.rows[0]).toMatchObject({ rank: 1, behind: 0, isUser: false, player: { _id: rival } });
    expect(opoy.rows.some((r) => r.isUser)).toBe(true);
    const mvp = race.find((r) => r.type === "MVP")!;
    expect(mvp.rows.some((r) => r.player.displayName === "Drake Maye")).toBe(true);
  });

  test("a rookie is whoever this year's draft named", async () => {
    const { t, owner, seasonId, player } = await setup();
    const henderson = await player("Henderson");
    await t.run((ctx) =>
      ctx.db.patch("players", henderson, { draft: { year: SAMPLE_START_YEAR, round: 2 } }),
    );
    const race = await owner.query(api.awards.race.bySeason, { seasonId });
    const oroy = race.find((r) => r.type === "OROY")!;
    expect(oroy.rows.map((r) => r.player._id)).toEqual([henderson]);
  });

  test("a season from another franchise reads as empty", async () => {
    const { t, owner, active } = await setup();
    const other = await t.run(async (ctx) => {
      const franchises = await ctx.db.query("franchises").take(5);
      const second = franchises.find((f) => f._id !== active.franchise._id);
      return ctx.db.insert("seasons", { franchiseId: second!._id, year: 2030, status: "upcoming" });
    });
    expect(await owner.query(api.awards.race.bySeason, { seasonId: other })).toEqual([]);
  });
});

describe("the cap for next season", () => {
  async function contracts(t: Awaited<ReturnType<typeof setup>>) {
    const entries = await t.t.run((ctx) =>
      ctx.db
        .query("rosterEntries")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", t.seasonId))
        .take(300),
    );
    const ours = entries.filter((e) => e.teamId === t.active.franchise.userTeamId);
    const [up, staying] = ours as [(typeof ours)[number], (typeof ours)[number]];
    await t.t.run(async (ctx) => {
      for (const entry of entries) await ctx.db.patch("rosterEntries", entry._id, { contract: undefined });
      await ctx.db.patch("rosterEntries", up._id, { contract: { apy: 10_000_000, years: 1 } });
      await ctx.db.patch("rosterEntries", staying._id, { contract: { apy: 4_000_000, years: 3 } });
    });
    return { up: up.playerId, staying: staying.playerId };
  }

  test("takes off what expires, against next season's cap once it has one", async () => {
    const t = await setup();
    const { up } = await contracts(t);
    await t.owner.mutation(api.players.cap.setSalaryCap, { seasonId: t.seasonId, salaryCap: 100_000_000 });
    const before = await t.owner.query(api.players.cap.bySeason, { seasonId: t.seasonId });
    expect(before.next.freed).toBe(10_000_000);
    expect(before.next.committed).toBe(before.committed - 10_000_000);
    expect(before.next.space).toBe(100_000_000 - before.next.committed);
    expect(before.players.find((p) => p.playerId === up)?.expiring).toBe(true);

    await t.t.run(async (ctx) => {
      const next = await ctx.db
        .query("seasons")
        .withIndex("by_franchiseId_and_year", (q) =>
          q.eq("franchiseId", t.franchiseId).eq("year", SAMPLE_START_YEAR + 1),
        )
        .unique();
      if (next) await ctx.db.patch("seasons", next._id, { salaryCap: 120_000_000 });
      else {
        await ctx.db.insert("seasons", {
          franchiseId: t.franchiseId,
          year: SAMPLE_START_YEAR + 1,
          status: "upcoming",
          salaryCap: 120_000_000,
        });
      }
    });
    const after = await t.owner.query(api.players.cap.bySeason, { seasonId: t.seasonId });
    expect(after.next.space).toBe(120_000_000 - after.next.committed);
  });
});

describe("Hall of Fame cases", () => {
  test("a case reads the player's lists, honors and marks", async () => {
    const { t, owner, franchiseId, seasonId, player } = await setup();
    const maye = await player("Maye");
    const before = await owner.query(api.hof.case.forPlayer, { playerId: maye });
    await t.run(async (ctx) => {
      await ctx.db.insert("recordPlacements", {
        franchiseId,
        playerId: maye,
        book: "team",
        split: "regular",
        scope: "career",
        statKey: "passYds",
        rank: 1,
        value: 40000,
      });
      const award = { franchiseId, seasonId, scope: "league" as const, playerId: maye };
      await ctx.db.insert("awards", { ...award, type: "MVP" });
      await ctx.db.insert("awards", { ...award, type: "OPOW", weekKey: "w3" });
    });
    const result = await owner.query(api.hof.case.forPlayer, { playerId: maye });
    expect(result).toMatchObject({
      honors: [{ label: "Most Valuable Player", count: 1 }],
      weekly: before.weekly + 1,
      records: ["#1 career passing yards"],
      firsts: 1,
      lists: 1,
    });
    expect(result.seasons).toBeGreaterThan(0);
  });

  async function retire(
    s: Awaited<ReturnType<typeof setup>>,
    playerId: Id<"players">,
    year: number,
    teamId?: Id<"teams">,
  ) {
    await s.t.run(async (ctx) => {
      const seasons = await ctx.db
        .query("seasons")
        .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", s.franchiseId).eq("year", year))
        .unique();
      const seasonId =
        seasons?._id ??
        (await ctx.db.insert("seasons", { franchiseId: s.franchiseId, year, status: "complete" }));
      await ctx.db.patch("players", playerId, { retired: true });
      await ctx.db.insert("transactions", {
        franchiseId: s.franchiseId,
        seasonId,
        type: "retire",
        teamId,
        playersIn: [],
        playersOut: [{ playerId }],
        picksIn: [],
        picksOut: [],
      });
    });
  }

  async function yearsPass(s: Awaited<ReturnType<typeof setup>>, year: number) {
    await s.t.run(async (ctx) => {
      const seasons = await ctx.db
        .query("seasons")
        .withIndex("by_franchiseId_and_year", (q) =>
          q.eq("franchiseId", s.franchiseId).gte("year", SAMPLE_START_YEAR),
        )
        .take(20);
      for (const season of seasons) await ctx.db.patch("seasons", season._id, { status: "complete" });
      await ctx.db.insert("seasons", { franchiseId: s.franchiseId, year, status: "regular" });
    });
  }

  test("a retired player comes up five seasons on, and once only", async () => {
    const s = await setup();
    const maye = await s.player("Maye");
    await retire(s, maye, SAMPLE_START_YEAR, s.active.franchise.userTeamId);
    await yearsPass(s, SAMPLE_START_YEAR + 4);
    expect((await s.owner.query(api.hof.case.eligible, {})).players).toEqual([]);

    await yearsPass(s, SAMPLE_START_YEAR + 5);
    expect((await s.owner.query(api.hof.case.eligible, {})).players).toMatchObject([
      { playerId: maye, retiredYear: SAMPLE_START_YEAR, newlyEligible: true },
    ]);

    await yearsPass(s, SAMPLE_START_YEAR + 6);
    expect((await s.owner.query(api.hof.case.eligible, {})).players).toMatchObject([
      { playerId: maye, newlyEligible: false },
    ]);

    await s.owner.mutation(api.hof.entries.inductPlayer, {
      playerId: maye,
      inductedYear: SAMPLE_START_YEAR + 6,
      retiredNumber: false,
    });
    expect((await s.owner.query(api.hof.case.eligible, {})).players).toEqual([]);
  });

  test("another team's retirement and an undone one stay off the list", async () => {
    const s = await setup();
    const [maye, diggs] = [await s.player("Maye"), await s.player("Diggs")];
    await retire(s, maye, SAMPLE_START_YEAR, await s.team("BUF"));
    await retire(s, diggs, SAMPLE_START_YEAR, s.active.franchise.userTeamId);
    await s.t.run((ctx) => ctx.db.patch("players", diggs, { retired: false }));
    await yearsPass(s, SAMPLE_START_YEAR + 5);
    expect((await s.owner.query(api.hof.case.eligible, {})).players).toEqual([]);
  });
});
