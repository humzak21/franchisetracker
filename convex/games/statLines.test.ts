/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const { games } = await owner.query(api.games.schedule.bySeason, { seasonId });
  const w1 = games.find((g) => g.weekKey === "w1")!;
  const box = () => owner.query(api.games.boxScore.get, { gameId: w1._id });
  const user = async () => (await box()).teams.find((x) => x.isUser)!;
  const season = async (name: string) => {
    const rows = await owner.query(api.stats.season.bySplit, { seasonId, split: "regular" });
    return rows.find((r) => r.name === name);
  };
  const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, owner, w1, box, user, season, settle, userTeamId: active.franchise.userTeamId };
}

describe("games/statLines", () => {
  test("editing a stat updates the line and the season totals, idempotently", async () => {
    const { owner, w1, user, season, settle } = await setup();
    const maye = (await user()).lines.find((l) => l.name === "Drake Maye")!;
    expect(maye.stats.passYds).toBe(284);
    const edit = { gameId: w1._id, playerId: maye.playerId, statKey: "passYds", value: 300 };
    await owner.mutation(api.games.statLines.setStat, edit);
    await owner.mutation(api.games.statLines.setStat, edit);
    await settle();
    expect((await user()).lines.find((l) => l.name === "Drake Maye")!.stats.passYds).toBe(300);
    expect((await season("Drake Maye"))!.totals.passYds).toBe(1403 + 16);

    await owner.mutation(api.games.statLines.setStat, { ...edit, statKey: "passTd", value: null });
    expect((await user()).lines.find((l) => l.name === "Drake Maye")!.stats.passTd).toBeUndefined();
  });

  test("refuses derived stats and out-of-range numbers", async () => {
    const { owner, w1, user } = await setup();
    const maye = (await user()).lines.find((l) => l.name === "Drake Maye")!;
    const base = { gameId: w1._id, playerId: maye.playerId };
    await expect(
      owner.mutation(api.games.statLines.setStat, { ...base, statKey: "passRating", value: 100 }),
    ).rejects.toThrow(/Only recorded stats/);
    await expect(
      owner.mutation(api.games.statLines.setStat, { ...base, statKey: "passYds", value: 1e6 }),
    ).rejects.toThrow(/out of range/);
  });

  test("adds a line for a typed name, merges into an existing player, and removes a line", async () => {
    const { owner, w1, user, season, settle, userTeamId } = await setup();
    const kickerId = await owner.mutation(api.games.statLines.addLine, {
      gameId: w1._id,
      teamId: userTeamId,
      name: "  Walk On  ",
      position: "K",
      stats: { fgm: 2, fga: 3 },
    });
    await settle();
    expect((await user()).lines.find((l) => l.playerId === kickerId)).toMatchObject({
      name: "Walk On",
      stats: { fgm: 2, fga: 3 },
    });
    expect((await season("Walk On"))!.totals.fgm).toBe(2);

    const mayeId = await owner.mutation(api.games.statLines.addLine, {
      gameId: w1._id,
      teamId: userTeamId,
      name: "Drake Maye",
      stats: { rushAtt: 99 },
    });
    const maye = (await user()).lines.find((l) => l.playerId === mayeId)!;
    expect(maye.stats).toMatchObject({ passYds: 284, rushAtt: 99 });

    await owner.mutation(api.games.statLines.removeLine, { gameId: w1._id, playerId: kickerId });
    await settle();
    expect((await user()).lines.some((l) => l.playerId === kickerId)).toBe(false);
    expect(await season("Walk On")).toBeUndefined();
  });

  test("edits team stats, clearing the row when empty", async () => {
    const { owner, w1, user, userTeamId } = await setup();
    const base = { gameId: w1._id, teamId: userTeamId, statKey: "totalYds" };
    await owner.mutation(api.games.statLines.setTeamStat, { ...base, value: 412 });
    expect((await user()).stats).toEqual({ totalYds: 412 });
    await owner.mutation(api.games.statLines.setTeamStat, { ...base, value: null });
    expect((await user()).stats).toBeNull();
    await expect(
      owner.mutation(api.games.statLines.setTeamStat, { ...base, statKey: "nope", value: 1 }),
    ).rejects.toThrow(/Unknown team stat/);
  });

  test("strangers and signed-out callers are refused", async () => {
    const { t, w1, user, userTeamId } = await setup();
    const maye = (await user()).lines[0]!;
    const stranger = await asStranger(t);
    await expect(
      stranger.mutation(api.games.statLines.setStat, {
        gameId: w1._id,
        playerId: maye.playerId,
        statKey: "passYds",
        value: 1,
      }),
    ).rejects.toThrow(/Not the owner/);
    await expect(
      t.mutation(api.games.statLines.setTeamStat, {
        gameId: w1._id,
        teamId: userTeamId,
        statKey: "plays",
        value: 1,
      }),
    ).rejects.toThrow(/Sign in required/);
  });
});
