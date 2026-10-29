/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { emptyRow, newLine } from "../../shared/ingestion/manual";
import { rowTarget } from "../../shared/ingestion/targets";
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
  const season = (year: number) => active.seasons.find((s) => s.year === year)!._id;
  const maye = await t.run((ctx) =>
    ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_displayName", (q) =>
        q.eq("franchiseId", active.franchise._id).eq("displayName", "Drake Maye"),
      )
      .first(),
  );
  const corrections = () => t.run((ctx) => ctx.db.query("corrections").take(10));
  const entry = async (draftId: Id<"manualDrafts">) => {
    const found = await owner.query(api.ingestion.manual.get, { draftId });
    if (!found) throw new Error("entry missing");
    return found;
  };
  return { t, owner, season, maye: maye!, corrections, entry };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("manual entry", () => {
  test("a yearly award typed in commits through the row commit and records no correction", async () => {
    const { owner, season, maye, corrections, entry: getEntry } = await setup();
    const seasonId = season(SAMPLE_START_YEAR);
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "yearly_awards",
      seasonId,
      // A season screen ignores the week it was started in.
      weekKey: "w3",
    });
    const entry = await getEntry(draftId);
    expect(entry).toMatchObject({ status: "open", weekKey: null, draft: { rows: [] } });
    expect(await owner.query(api.ingestion.manual.listOpen, {})).toHaveLength(1);
    if (!("rows" in entry.draft)) throw new Error("not a row draft");

    const row = emptyRow(rowTarget("yearly_awards").spec, entry.draft, {
      name: maye.displayName,
      playerId: maye._id,
      teamAbbr: "NE",
      position: "QB",
    });
    const draft = { ...entry.draft, rows: [{ ...row, values: { ...row.values, award: "MVP" } }] };
    await owner.mutation(api.ingestion.manualCommit.saveDraft, { draftId, draft });
    await owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft });

    const awards = await owner.query(api.awards.awards.bySeason, { seasonId });
    expect(awards.some((a) => a.type === "MVP" && a.player?._id === maye._id)).toBe(true);
    expect(await corrections()).toEqual([]);
    expect(await owner.query(api.ingestion.manual.listOpen, {})).toEqual([]);
    expect((await getEntry(draftId)).status).toBe("committed");
    await expect(owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft })).rejects.toThrow(
      /already committed/,
    );
  });

  test("a box score typed in for a week creates the game, its lines and season totals", async () => {
    const { t, owner, season, maye, corrections, entry } = await setup();
    const seasonId = season(SAMPLE_START_YEAR + 1);
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "game_box_score",
      seasonId,
      weekKey: "w1",
    });
    const { draft: empty, game } = await entry(draftId);
    expect(game).toBeNull();
    if (empty.target !== "game_box_score") throw new Error("wrong target");
    expect(empty.game).toMatchObject({ homeAbbr: "NE", awayAbbr: null });

    const line = newLine(empty.lines, { name: maye.displayName, playerId: maye._id, teamAbbr: "NE" });
    const draft = {
      ...empty,
      game: { ...empty.game, awayAbbr: "MIA", homeScore: 24, awayScore: 10 },
      lines: [
        { ...line, position: "QB" as const, stats: { passYds: 301, passTd: 2, passCmp: 20, passAtt: 28 } },
      ],
    };
    const { gameId } = await owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.get("games", gameId!))).toMatchObject({
      weekKey: "w1",
      status: "played",
      result: "W",
    });
    const box = await owner.query(api.games.boxScore.get, { gameId: gameId! });
    expect(box.teams[0]!.lines.find((l) => l.name === "Drake Maye")?.stats.passYds).toBe(301);
    expect(await corrections()).toEqual([]);
  });

  test("an entry started from a game files under it and starts from its teams", async () => {
    const { owner, season, entry: getEntry } = await setup();
    const { games } = await owner.query(api.games.schedule.bySeason, { seasonId: season(SAMPLE_START_YEAR) });
    const week1 = games.find((g) => g.weekKey === "w1")!;
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "team_game_stats",
      gameId: week1._id,
    });
    const entry = await getEntry(draftId);
    expect(entry).toMatchObject({ weekKey: "w1", game: { _id: week1._id, opponentAbbr: "LV" } });
    expect(entry.draft.target === "team_game_stats" && entry.draft.teams.map((c) => c.teamAbbr)).toContain(
      "LV",
    );
  });

  test("context is checked, and an open entry can be discarded", async () => {
    const { owner, season, entry } = await setup();
    await expect(owner.mutation(api.ingestion.manual.create, { targetKey: "standings" })).rejects.toThrow(
      /season/,
    );
    await expect(
      owner.mutation(api.ingestion.manual.create, {
        targetKey: "weekly_awards",
        seasonId: season(SAMPLE_START_YEAR),
      }),
    ).rejects.toThrow(/week/);
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "standings",
      seasonId: season(SAMPLE_START_YEAR),
    });
    const { draft } = await entry(draftId);
    // An empty list cannot be committed.
    await expect(owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft })).rejects.toThrow(
      /no rows/,
    );
    await owner.mutation(api.ingestion.manualCommit.discard, { draftId });
    expect(await owner.query(api.ingestion.manual.get, { draftId })).toBeNull();
    // A save already on its way when Discard landed has nothing left to write.
    await expect(
      owner.mutation(api.ingestion.manualCommit.saveDraft, { draftId, draft }),
    ).resolves.toBeNull();
    await expect(owner.mutation(api.ingestion.manualCommit.discard, { draftId })).rejects.toThrow(
      /not found/,
    );
  });

  test("another team's season stats go to League stats, never onto our roster", async () => {
    const { t, owner, season, entry } = await setup();
    const seasonId = season(SAMPLE_START_YEAR);
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "season_player_stats",
      seasonId,
    });
    const empty = (await entry(draftId)).draft;
    if (!("rows" in empty)) throw new Error("not a row draft");
    // The screen is filtered to Buffalo, so its rows print no team of their own.
    const row = emptyRow(rowTarget("season_player_stats").spec, empty, { name: "Buffalo Newcomer" });
    const draft = {
      ...empty,
      meta: { ...empty.meta, team: "BUF" },
      rows: [{ ...row, values: { ...row.values, position: "WR", gamesPlayed: 6, rec: 30, recYds: 410 } }],
    };
    await owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft });

    const { rows, teams } = await owner.query(api.stats.league.bySeason, { seasonId });
    const line = rows.find((r) => r.name === "Buffalo Newcomer");
    expect(line).toMatchObject({ isUser: false, source: "reported" });
    expect(teams.find((tm) => tm._id === line?.teamId)?.abbr).toBe("BUF");
    const roster = await owner.query(api.players.roster.bySeason, { seasonId });
    expect(roster.entries.some((e) => e.player.displayName === "Buffalo Newcomer")).toBe(false);
    expect(
      (await t.run((ctx) => ctx.db.query("reportedSeasonStats").take(100))).filter(
        (r) => r.playerId === line?.playerId,
      ),
    ).toHaveLength(1);
  });

  test("season stats rows without a team are refused until one is picked", async () => {
    const { owner, season, entry } = await setup();
    const seasonId = season(SAMPLE_START_YEAR);
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "season_player_stats",
      seasonId,
    });
    const empty = (await entry(draftId)).draft;
    if (!("rows" in empty)) throw new Error("not a row draft");
    const row = emptyRow(rowTarget("season_player_stats").spec, empty, { name: "Nobody's Player" });
    const draft = { ...empty, meta: { ...empty.meta, team: null }, rows: [row] };
    await expect(owner.mutation(api.ingestion.manualCommit.commit, { draftId, draft })).rejects.toThrow(
      /pick the team/,
    );
  });

  test("strangers and signed-out callers are refused", async () => {
    const { t, owner, season } = await setup();
    const draftId = await owner.mutation(api.ingestion.manual.create, {
      targetKey: "standings",
      seasonId: season(SAMPLE_START_YEAR),
    });
    const stranger = await asStranger(t);
    await expect(stranger.query(api.ingestion.manual.get, { draftId })).rejects.toThrow(/Not the owner/);
    await expect(stranger.mutation(api.ingestion.manualCommit.discard, { draftId })).rejects.toThrow(
      /Not the owner/,
    );
    await expect(
      t.mutation(api.ingestion.manual.create, {
        targetKey: "standings",
        seasonId: season(SAMPLE_START_YEAR),
      }),
    ).rejects.toThrow(/Sign in required/);
  });
});
