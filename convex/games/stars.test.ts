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
  return { t, owner, seasonId, week1 };
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
    expect(detail?.stars.map((s) => s.name)).toEqual([
      "Stefon Diggs",
      "Maxx Crosby",
      "Drake Maye",
      "Hunter Henry",
    ]);
    expect(detail?.stars[0]).toMatchObject({ caption: "131 yds", teamId: pick("Stefon Diggs").teamId });
    expect(detail?.stars[1]).toMatchObject({ playerId: null, teamId: week1.opponent!._id });

    // Saving the same list again changes nothing; an empty list clears them.
    await owner.mutation(api.games.stars.setStars, { gameId: week1._id, stars });
    expect((await owner.query(api.games.schedule.get, { gameId: week1._id }))?.stars).toHaveLength(4);
    await owner.mutation(api.games.stars.setStars, { gameId: week1._id, stars: [] });
    expect((await owner.query(api.games.schedule.get, { gameId: week1._id }))?.stars).toEqual([]);
  });

  test("each star carries their line from the box score, already-picked stars included", async () => {
    const { t, owner, seasonId, week1 } = await setup();
    const candidates = await owner.query(api.games.stars.candidates, { gameId: week1._id });
    const maye = candidates.find((c) => c.name === "Drake Maye")!;
    // Stars saved before stat lines were shown get them too: nothing about the star is stored.
    await t.run((ctx) =>
      ctx.db.patch("games", week1._id, { stars: [{ playerId: maye.playerId }, { rawName: "Maxx Crosby" }] }),
    );
    const line = await t.run((ctx) =>
      ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", week1._id).eq("playerId", maye.playerId))
        .first(),
    );
    const { passCmp, passAtt, passYds, passTd } = line!.stats;
    const detail = await owner.query(api.games.schedule.get, { gameId: week1._id });
    expect(detail?.stars[0]?.statLine).toMatch(
      new RegExp(`^${passCmp}/${passAtt}, [\\d.]+%, ${passYds} yds, ${passTd} TD`),
    );
    expect(detail?.stars[1]?.statLine).toBeNull();
    const { games } = await owner.query(api.games.schedule.bySeason, { seasonId });
    expect(games.find((g) => g._id === week1._id)?.stars[0]?.statLine).toBe(detail?.stars[0]?.statLine);
  });

  test("the backfill clears typed stat lines that the box score now gives, and keeps notes", async () => {
    const { t, owner, week1 } = await setup();
    const candidates = await owner.query(api.games.stars.candidates, { gameId: week1._id });
    const id = (name: string) => candidates.find((c) => c.name === name)!.playerId;
    const before = [
      { playerId: id("Drake Maye"), caption: "22/30, 284 yds, 3 TD" },
      { playerId: id("Stefon Diggs"), caption: "Iced it on third down" },
      { rawName: "Maxx Crosby", caption: "2 sacks" },
    ];
    await t.run((ctx) => ctx.db.patch("games", week1._id, { stars: before }));
    const preview = await t.mutation(internal.games.clearTypedStarLines.run, { dryRun: true });
    expect(preview).toEqual([{ year: SAMPLE_START_YEAR, weekKey: "w1", caption: "22/30, 284 yds, 3 TD" }]);
    expect((await t.run((ctx) => ctx.db.get("games", week1._id)))?.stars).toEqual(before);

    await t.mutation(internal.games.clearTypedStarLines.run, {});
    expect((await t.run((ctx) => ctx.db.get("games", week1._id)))?.stars).toEqual([
      { playerId: id("Drake Maye") },
      before[1],
      before[2],
    ]);
    expect(await t.mutation(internal.games.clearTypedStarLines.run, {})).toEqual([]);
  });

  test("one click in the box score makes a player a star, a second click takes him out", async () => {
    const { owner, week1 } = await setup();
    const candidates = await owner.query(api.games.stars.candidates, { gameId: week1._id });
    const diggs = candidates.find((c) => c.name === "Stefon Diggs")!;
    const maye = candidates.find((c) => c.name === "Drake Maye")!;
    const stars = async () => (await owner.query(api.games.schedule.get, { gameId: week1._id }))!.stars;
    await owner.mutation(api.games.stars.setStars, {
      gameId: week1._id,
      stars: [{ playerId: maye.playerId, caption: "Note" }, { rawName: "Maxx Crosby" }],
    });

    const toggle = () =>
      owner.mutation(api.games.stars.toggle, {
        gameId: week1._id,
        playerId: diggs.playerId,
        teamId: diggs.teamId,
      });
    expect(await toggle()).toBe(true);
    expect((await stars()).map((s) => [s.name, s.caption])).toEqual([
      ["Drake Maye", "Note"],
      ["Maxx Crosby", null],
      ["Stefon Diggs", null],
    ]);
    expect((await stars())[2]?.statLine).toBe(diggs.statLine);
    expect(await toggle()).toBe(false);
    expect((await stars()).map((s) => s.name)).toEqual(["Drake Maye", "Maxx Crosby"]);
  });

  test("one click stars a whole defense, with its line added up from the box score", async () => {
    const { t, owner, seasonId, week1 } = await setup();
    const candidates = await owner.query(api.games.stars.candidates, { gameId: week1._id });
    const teamId = candidates.find((c) => c.name === "Drake Maye")!.teamId;
    const stars = async () => (await owner.query(api.games.schedule.get, { gameId: week1._id }))!.stars;
    const toggle = () => owner.mutation(api.games.stars.toggleDefense, { gameId: week1._id, teamId });

    expect(await toggle()).toBe(true);
    const star = (await stars()).at(-1);
    expect(star).toMatchObject({ name: "NE Defense", playerId: null, teamId, teamDefense: true });
    expect(star?.statLine).toMatch(/^\d+ TKLs/);

    // Nothing but the pick is stored, so a corrected box score corrects the line; the schedule shows the same.
    const line = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", week1._id).eq("teamId", teamId))
        .take(100);
      return rows.find((row) => (row.stats.tackles ?? 0) > 0)!;
    });
    await t.run((ctx) =>
      ctx.db.patch("gameStatLines", line._id, {
        stats: { ...line.stats, tackles: (line.stats.tackles ?? 0) + 100 },
      }),
    );
    const corrected = (await stars()).at(-1)?.statLine;
    expect(corrected).not.toBe(star?.statLine);
    const { games } = await owner.query(api.games.schedule.bySeason, { seasonId });
    expect(games.find((g) => g._id === week1._id)?.stars.at(-1)?.statLine).toBe(corrected);

    // It round-trips through the editor's save, and a second click takes it out.
    await owner.mutation(api.games.stars.setStars, {
      gameId: week1._id,
      stars: [{ teamDefense: true, teamId, caption: "Six sacks" }],
    });
    expect((await stars())[0]).toMatchObject({ name: "NE Defense", caption: "Six sacks" });
    expect(await toggle()).toBe(false);
    expect(await stars()).toEqual([]);
  });

  test("a defense has to have played in the game", async () => {
    const { owner, week1 } = await setup();
    const teams = await owner.query(api.league.teams.list, {});
    const other = teams.find((team) => team.abbr === "SEA")!;
    await expect(
      owner.mutation(api.games.stars.toggleDefense, { gameId: week1._id, teamId: other._id }),
    ).rejects.toThrow(/did not play/);
    await expect(
      owner.mutation(api.games.stars.setStars, {
        gameId: week1._id,
        stars: [{ teamDefense: true, teamId: other._id }],
      }),
    ).rejects.toThrow(/did not play/);
  });

  test("candidates in the box score carry the line a star shows; roster-only players have none", async () => {
    const { owner, week1 } = await setup();
    const candidates = await owner.query(api.games.stars.candidates, { gameId: week1._id });
    expect(candidates.find((c) => c.name === "Drake Maye")?.statLine).toMatch(/^\d+\/\d+, [\d.]+%, \d+ yds/);
    expect(candidates.filter((c) => !c.inGame).every((c) => c.statLine === null)).toBe(true);
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
      stranger.mutation(api.games.stars.toggle, {
        gameId: week1._id,
        playerId: (await t.run((ctx) => ctx.db.query("players").first()))!._id,
        teamId: week1.opponent!._id,
      }),
    ).rejects.toThrow(/Not the owner/);
    await expect(
      stranger.mutation(api.games.stars.toggleDefense, {
        gameId: week1._id,
        teamId: week1.opponent!._id,
      }),
    ).rejects.toThrow(/Not the owner/);
    await expect(
      stranger.mutation(api.games.stars.setStars, { gameId: week1._id, stars: [] }),
    ).rejects.toThrow(/Not the owner/);
    await expect(t.query(api.games.stars.candidates, { gameId: week1._id })).rejects.toThrow(
      /Sign in required/,
    );
  });
});
