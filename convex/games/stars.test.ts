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
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const { games } = await owner.query(api.games.schedule.bySeason, { seasonId });
  const week1 = games.find((g) => g.weekKey === "w1")!;
  return { t, owner, week1 };
}

describe("games/stars", () => {
  test("candidates list the game's players first, then the rest of the roster", async () => {
    const { owner, week1 } = await setup();
    const candidates = await owner.query(api.games.stars.candidates, { gameId: week1._id });
    const firstRosterOnly = candidates.findIndex((c) => !c.inGame);
    expect(candidates.slice(0, Math.max(firstRosterOnly, 0)).every((c) => c.inGame)).toBe(true);
    expect(candidates.find((c) => c.name === "Drake Maye")).toMatchObject({ inGame: true, position: "QB" });
    expect(new Set(candidates.map((c) => c.playerId)).size).toBe(candidates.length);
  });

  test("saves any number of stars in order, with typed names and captions", async () => {
    const { owner, week1 } = await setup();
    const candidates = await owner.query(api.games.stars.candidates, { gameId: week1._id });
    const pick = (name: string) => candidates.find((c) => c.name === name)!;
    const stars = [
      { playerId: pick("Stefon Diggs").playerId, teamId: pick("Stefon Diggs").teamId, caption: " 131 yds " },
      { rawName: "Maxx Crosby", teamId: week1.opponent!._id },
      { playerId: pick("Drake Maye").playerId },
      { rawName: "Hunter Henry" },
    ];
    await owner.mutation(api.games.stars.setStars, { gameId: week1._id, stars });
    const detail = await owner.query(api.games.schedule.get, { gameId: week1._id });
    expect(detail.stars.map((s) => s.name)).toEqual([
      "Stefon Diggs",
      "Maxx Crosby",
      "Drake Maye",
      "Hunter Henry",
    ]);
    expect(detail.stars[0]).toMatchObject({ caption: "131 yds", teamId: pick("Stefon Diggs").teamId });
    expect(detail.stars[1]).toMatchObject({ playerId: null, teamId: week1.opponent!._id });

    // Saving the same list again changes nothing; an empty list clears them.
    await owner.mutation(api.games.stars.setStars, { gameId: week1._id, stars });
    expect((await owner.query(api.games.schedule.get, { gameId: week1._id })).stars).toHaveLength(4);
    await owner.mutation(api.games.stars.setStars, { gameId: week1._id, stars: [] });
    expect((await owner.query(api.games.schedule.get, { gameId: week1._id })).stars).toEqual([]);
  });

  test("refuses blank or duplicate stars", async () => {
    const { owner, week1 } = await setup();
    await expect(
      owner.mutation(api.games.stars.setStars, { gameId: week1._id, stars: [{ rawName: "  " }] }),
    ).rejects.toThrow(/needs a player or a name/);
    const [maye] = await owner.query(api.games.stars.candidates, { gameId: week1._id });
    await expect(
      owner.mutation(api.games.stars.setStars, {
        gameId: week1._id,
        stars: [{ playerId: maye!.playerId }, { playerId: maye!.playerId }],
      }),
    ).rejects.toThrow(/only be a star once/);
  });

  test("strangers and signed-out callers are refused", async () => {
    const { t, week1 } = await setup();
    const stranger = await asStranger(t);
    await expect(
      stranger.mutation(api.games.stars.setStars, { gameId: week1._id, stars: [] }),
    ).rejects.toThrow(/Not the owner/);
    await expect(t.query(api.games.stars.candidates, { gameId: week1._id })).rejects.toThrow(
      /Sign in required/,
    );
  });
});
