/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

afterEach(() => {
  delete process.env.OWNER_EMAILS;
});

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const season = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!;
  const roster = await owner.query(api.players.roster.bySeason, { seasonId: season._id });
  const id = (name: string) => roster.entries.find((e) => e.player.displayName === name)!.player._id;
  /** A second "Drake Maye" as a box score would create him before review matched the name. */
  const duplicate = (name: string) =>
    t.run(async (ctx) => {
      const [first, ...rest] = name.split(" ");
      const playerId = await ctx.db.insert("players", {
        franchiseId: active.franchise._id,
        firstName: first!,
        lastName: rest.join(" "),
        displayName: name,
        position: "QB",
        isReal: true,
        retired: false,
        aliases: [],
      });
      const game = (await ctx.db.query("games").take(10)).find((g) => g.weekKey === "w2")!;
      await ctx.db.insert("gameStatLines", {
        franchiseId: active.franchise._id,
        seasonId: season._id,
        gameId: game._id,
        playerId,
        teamId: active.franchise.userTeamId,
        weekKey: "w2",
        position: "QB",
        stats: { passAtt: 1, passCmp: 1, passYds: 9 },
      });
      return playerId;
    });
  return { t, owner, season, id, duplicate, franchiseId: active.franchise._id };
}

describe("players/identity", () => {
  test("a captured near-duplicate is flagged and merging folds it into the real player", async () => {
    const { owner, id, duplicate, season } = await seeded();
    const maye = id("Drake Maye");
    const dupe = await duplicate("Drake Maey");
    const pairs = await owner.query(api.players.identity.duplicates, {});
    expect(pairs.some((p) => p.captured.playerId === dupe && p.match.playerId === maye)).toBe(true);

    await owner.mutation(api.players.identity.merge, { sourceId: dupe, targetId: maye });
    const page = await owner.query(api.players.player.get, { playerId: maye });
    expect(page.player.aliases).toContain("Drake Maey");
    const log = await owner.query(api.players.gameLog.bySeason, { playerId: maye, seasonId: season._id });
    // Maye already had a w2 line, so the duplicate's line in the same game is dropped.
    expect(log.filter((g) => g.weekKey === "w2")).toHaveLength(1);
    expect(log).toHaveLength(5);
    await expect(owner.query(api.players.player.get, { playerId: dupe })).rejects.toThrow(/not found/);
    expect(await owner.query(api.players.identity.duplicates, {})).toEqual([]);
  });

  test("merging two distinct imported players is refused", async () => {
    const { owner, id } = await seeded();
    await expect(
      owner.mutation(api.players.identity.merge, {
        sourceId: id("Drake Maye"),
        targetId: id("Hunter Henry"),
      }),
    ).rejects.toThrow(/distinct real players/);
  });

  test("renaming keeps the old name as an alias; aliases are tidied", async () => {
    const { owner, id } = await seeded();
    const playerId = id("Hunter Henry");
    await owner.mutation(api.players.identity.setName, { playerId, displayName: "Hunter  Henry III" });
    const { player } = await owner.query(api.players.player.get, { playerId });
    expect(player).toMatchObject({
      firstName: "Hunter",
      lastName: "Henry III",
      displayName: "Hunter Henry III",
    });
    expect(player.aliases).toEqual(["Hunter Henry"]);
    await owner.mutation(api.players.identity.setAliases, {
      playerId,
      aliases: [" H. Henry ", "h. henry", "Hunter Henry III", ""],
    });
    expect((await owner.query(api.players.player.get, { playerId })).player.aliases).toEqual(["H. Henry"]);
  });

  test("a name corrected in review renames every player still carrying the misread name", async () => {
    const { t, owner, duplicate, franchiseId } = await seeded();
    const misread = await duplicate("Drake Mayo");
    await t.run((ctx) =>
      ctx.db.insert("corrections", {
        franchiseId,
        targetKey: "game_box_score",
        fieldPath: "lines.l1.name",
        extractedValue: "Drake Mayo",
        correctedValue: "Drake Maye",
        usedAsExample: true,
      }),
    );
    const [correction] = await owner.query(api.players.identity.nameCorrections, {});
    expect(correction).toMatchObject({
      from: "Drake Mayo",
      to: "Drake Maye",
      players: [{ playerId: misread }],
    });
    expect(
      await owner.mutation(api.players.identity.applyNameCorrection, {
        from: "Drake Mayo",
        to: "Drake Maye",
      }),
    ).toBe(1);
    expect(await owner.query(api.players.identity.nameCorrections, {})).toEqual([]);
    const named = await t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", franchiseId).eq("displayName", "Drake Maye"),
        )
        .collect(),
    );
    expect(named).toHaveLength(1);
  });

  test("a fictional player loses the photo for a monogram", async () => {
    const { owner, id } = await seeded();
    const playerId = id("Drake Maye");
    expect((await owner.query(api.players.player.get, { playerId })).headshotUrl).toMatch(/4431452/);
    await owner.mutation(api.players.identity.setReal, { playerId, isReal: false });
    expect((await owner.query(api.players.player.get, { playerId })).headshotUrl).toBeNull();
  });
});

describe("players/progression", () => {
  test("entry ratings and in-season snapshots form one series", async () => {
    const { owner, id, season } = await seeded();
    const playerId = id("Drake Maye");
    await owner.mutation(api.players.progression.saveSnapshot, {
      playerId,
      seasonId: season._id,
      weekKey: "w6",
      ovr: 82,
    });
    await owner.mutation(api.players.progression.saveSnapshot, {
      playerId,
      seasonId: season._id,
      weekKey: "w3",
      ovr: 80,
    });
    await owner.mutation(api.players.progression.saveSnapshot, {
      playerId,
      seasonId: season._id,
      weekKey: "w6",
      ovr: 83,
    });
    const points = await owner.query(api.players.progression.ovr, { playerId });
    expect(points.map((p) => [p.weekKey, p.ovr])).toEqual([
      [null, 79],
      ["w3", 80],
      ["w6", 83],
    ]);
    await owner.mutation(api.players.progression.removeSnapshot, { snapshotId: points[1]!.snapshotId! });
    expect(await owner.query(api.players.progression.ovr, { playerId })).toHaveLength(2);
    await expect(
      owner.mutation(api.players.progression.saveSnapshot, {
        playerId,
        seasonId: season._id,
        weekKey: "w7",
        ovr: 120,
      }),
    ).rejects.toThrow(/0 to 99/);
  });

  test("ratings edits update the season's roster entry", async () => {
    const { owner, season } = await seeded();
    const roster = await owner.query(api.players.roster.bySeason, { seasonId: season._id });
    const entryId = roster.entries.find((e) => e.player.displayName === "Drake Maye")!.entry._id;
    await owner.mutation(api.players.progression.updateRatings, {
      entryId,
      ovr: 81,
      devTrait: "star",
      abilities: [" Gunslinger ", "Gunslinger", ""],
    });
    const after = await owner.query(api.players.roster.bySeason, { seasonId: season._id });
    expect(after.entries.find((e) => e.entry._id === entryId)!.entry).toMatchObject({
      ovr: 81,
      devTrait: "star",
      abilities: ["Gunslinger"],
    });
  });
});

describe("players/directory and compare", () => {
  test("the index lists the team's franchise players and search reaches imported ones", async () => {
    const { owner } = await seeded();
    const { team, rows } = await owner.query(api.players.directory.byTeam, {});
    expect(team.abbr).toBe("NE");
    expect(rows.find((r) => r.displayName === "Drake Maye")).toMatchObject({
      seasons: 1,
      latestYear: SAMPLE_START_YEAR,
      ovr: 79,
    });
    const hits = await owner.query(api.players.directory.search, { text: "Maye" });
    expect(hits[0]).toMatchObject({ displayName: "Drake Maye", firstYear: 2024 });
  });

  test("compare returns career totals with imported seasons and franchise games", async () => {
    const { owner, id } = await seeded();
    const ids: Id<"players">[] = [id("Drake Maye"), id("Stefon Diggs")];
    const [maye, diggs] = await owner.query(api.players.compare.get, { playerIds: ids });
    expect(maye).toMatchObject({ displayName: "Drake Maye", firstYear: 2024, lastYear: SAMPLE_START_YEAR });
    expect(maye!.regular.seasons).toBe(3);
    expect(maye!.regular.totals.passYds).toBeGreaterThan(1403);
    expect(diggs!.team?.abbr).toBe("NE");
    await expect(owner.query(api.players.compare.get, { playerIds: [] })).rejects.toThrow(/one to four/);
  });
});
