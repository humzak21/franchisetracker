/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NFL_TEAMS } from "../../shared/domain/teams";
import { emptyRow } from "../../shared/ingestion/manual";
import { rowTarget } from "../../shared/ingestion/targets";
import { NFLVERSE_URLS } from "../../shared/history/nflverse";
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
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const leagueGames = () =>
    t.run((ctx) =>
      ctx.db
        .query("leagueGames")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
        .take(400),
    );
  return { t, owner, seasonId, leagueGames };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.AUTH_TEST_MODE;
});

describe("several weeks in one set", () => {
  test("each row files under its own week, so a rematch is a second game", async () => {
    const { owner, seasonId, leagueGames } = await setup();
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "league_schedule",
      seasonId,
      weekKey: "w8",
    });
    const entry = (await owner.query(api.ingestion.manual.get, { draftId }))!;
    if (!("rows" in entry.draft)) throw new Error("not a row draft");
    const spec = rowTarget("league_schedule").spec;
    const draft = entry.draft;
    const rows = (["w8", "w14"] as const).map((week) => {
      const row = emptyRow(spec, draft);
      return { ...row, values: { ...row.values, awayTeam: "SF", homeTeam: "LAC", week } };
    });
    await owner.mutation(api.ingestion.manualCommit.commit, {
      draftId,
      draft: { ...draft, meta: { week: null }, rows },
    });
    const games = await leagueGames();
    expect(
      games
        .filter((g) => g.weekKey === "w8" || g.weekKey === "w14")
        .map((g) => g.weekKey)
        .sort(),
    ).toEqual(["w14", "w8"]);
  });
});

const SCHEDULE = `season,game_type,week,weekday,gametime,away_team,away_score,home_team,home_score
${SAMPLE_START_YEAR},REG,1,Sunday,13:00,BUF,10,NE,3
${SAMPLE_START_YEAR},REG,1,Sunday,13:00,SF,,LAC,
${SAMPLE_START_YEAR},REG,12,Thursday,20:15,NE,,NYJ,
${SAMPLE_START_YEAR},REG,12,Sunday,16:25,SF,,SEA,
${SAMPLE_START_YEAR},WC,19,Saturday,16:30,PIT,,BAL,`;

describe("schedule from nflverse", () => {
  test("fills weeks with no games, never scores, and leaves captured weeks alone", async () => {
    const { t, owner, seasonId, leagueGames } = await setup();
    vi.stubGlobal("fetch", async (url: string) =>
      url === NFLVERSE_URLS.games ? new Response(SCHEDULE) : new Response("", { status: 404 }),
    );
    const before = (await leagueGames()).filter((g) => g.weekKey === "w1").length;
    const result = await owner.action(api.leagueGames.importSchedule.fromNflverse, { seasonId });
    // The sample franchise already played week 1, so only week 12 is new.
    expect(result.weeks + result.skipped).toBe(2);
    const games = await leagueGames();
    const w12 = games.filter((g) => g.weekKey === "w12");
    expect(w12).toHaveLength(2);
    expect(w12.every((g) => g.awayScore === undefined && g.homeScore === undefined)).toBe(true);
    expect(w12.map((g) => g.timeLabel).sort()).toEqual(["Sun 4:25 PM", "Thu 8:15 PM"]);
    if (result.skipped > 0) expect(games.filter((g) => g.weekKey === "w1")).toHaveLength(before);

    const schedule = await owner.query(api.games.schedule.bySeason, { seasonId });
    expect(schedule.games.find((g) => g.weekKey === "w12")).toMatchObject({ status: "scheduled" });

    // Running it again changes nothing.
    await owner.action(api.leagueGames.importSchedule.fromNflverse, { seasonId });
    expect((await leagueGames()).length).toBe(games.length);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  test("only the owner may import", async () => {
    const { t, seasonId } = await setup();
    const stranger = await asStranger(t);
    await expect(
      stranger.action(api.leagueGames.importSchedule.fromNflverse, { seasonId }),
    ).rejects.toThrow();
  });
});

/** Every team plays 17 games: a circle schedule, the team earlier in the list always winning at home. */
async function playRegularSeason(t: Awaited<ReturnType<typeof setup>>["t"], seasonId: Id<"seasons">) {
  await t.run(async (ctx) => {
    const season = (await ctx.db.get("seasons", seasonId))!;
    // The user team's record is its own games'; stand in a full season for it.
    await ctx.db.patch("seasons", seasonId, { userRecord: { w: 9, l: 8, t: 0 } });
    const ids = new Map((await ctx.db.query("teams").take(64)).map((team) => [team.abbr, team._id]));
    const teams = NFL_TEAMS.map((team) => team.abbr);
    for (let week = 1; week <= 17; week++) {
      const rotated = [teams[0]!, ...teams.slice(1).map((_, i) => teams[1 + ((i + week) % 31)]!)];
      for (let i = 0; i < 16; i++) {
        const [a, b] = [rotated[i]!, rotated[31 - i]!];
        const [home, away] = teams.indexOf(a) < teams.indexOf(b) ? [a, b] : [b, a];
        await ctx.db.insert("leagueGames", {
          franchiseId: season.franchiseId,
          seasonId,
          weekKey: `w${week}` as "w1",
          homeTeamId: ids.get(home)!,
          awayTeamId: ids.get(away)!,
          homeScore: 24,
          awayScore: 17,
        });
      }
    }
  });
  await t.mutation(internal.league.records.refreshAll, {});
}

describe("season board", () => {
  test("projects seeds and an empty bracket before the season is over", async () => {
    const { owner, seasonId } = await setup();
    const board = (await owner.query(api.league.board.season, { seasonId }))!;
    expect(board.final).toBe(false);
    expect(board.rows).toHaveLength(32);
    expect(board.rows.filter((r) => r.seed !== null)).toHaveLength(14);
    expect(board.bracket.filter((g) => g.round === "wc")).toHaveLength(6);
    expect(board.bracket.every((g) => g.winner === null)).toBe(true);
  });

  test("locks the field once every team has played, and reads playoff scores into results", async () => {
    const { t, owner, seasonId } = await setup();
    await playRegularSeason(t, seasonId);
    const board = (await owner.query(api.league.board.season, { seasonId }))!;
    expect(board.final).toBe(true);
    const derived = await t.run((ctx) =>
      ctx.db
        .query("standings")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId))
        .take(64),
    );
    expect(board.rows.filter((r) => r.seed !== null)).toHaveLength(14);
    // Captured rows keep their printed seeds; the worked-out ones get theirs from the scores.
    expect(derived.filter((r) => r.source === "derived" && r.seed !== undefined).length).toBeGreaterThan(8);
    expect(derived.filter((r) => r.source === "derived").every((r) => r.divisionRank !== undefined)).toBe(
      true,
    );

    const wc = board.bracket.find((g) => g.round === "wc")!;
    await t.run(async (ctx) => {
      const id = async (abbr: string) =>
        (await ctx.db
          .query("teams")
          .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
          .unique())!._id;
      await ctx.db.insert("leagueGames", {
        franchiseId: derived[0]!.franchiseId,
        seasonId,
        weekKey: "wc",
        homeTeamId: await id(wc.home.abbr),
        awayTeamId: await id(wc.away.abbr),
        homeScore: 10,
        awayScore: 13,
      });
    });
    await t.mutation(internal.league.records.refreshAll, {});
    const after = (await owner.query(api.league.board.season, { seasonId }))!;
    expect(after.bracket.find((g) => g.round === "wc" && g.home.abbr === wc.home.abbr)?.winner).toBe(
      wc.away.abbr,
    );
    const loser = after.rows.find((r) => r.team.abbr === wc.home.abbr);
    if (loser && wc.home.abbr !== "NE") expect(loser.playoffResult).toBe("wc_loss");
  });
});
