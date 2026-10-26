/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const maye = (await t.run((ctx) =>
    ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_displayName", (q) =>
        q.eq("franchiseId", active.franchise._id).eq("displayName", "Drake Maye"),
      )
      .first(),
  ))!;
  return { t, owner, maye };
}

describe("hall of fame", () => {
  test("inducting from the player page caches the career with the team and upserts", async () => {
    const { owner, maye } = await setup();
    const form = await owner.query(api.hof.entries.forPlayer, { playerId: maye._id });
    expect(form.entry).toBeNull();
    expect(form.defaults).toMatchObject({ inductedYear: SAMPLE_START_YEAR, jersey: 10 });
    expect(form.defaults.years).toContain(SAMPLE_START_YEAR);

    const entryId = await owner.mutation(api.hof.entries.inductPlayer, {
      playerId: maye._id,
      inductedYear: 2040,
      jersey: 10,
      retiredNumber: true,
      blurb: "  The franchise quarterback. ",
      highlightSeasons: [SAMPLE_START_YEAR, 1999],
    });
    const again = await owner.mutation(api.hof.entries.inductPlayer, {
      playerId: maye._id,
      inductedYear: 2041,
      jersey: 10,
      retiredNumber: true,
    });
    expect(again).toBe(entryId);

    const wall = await owner.query(api.hof.entries.wall, {});
    expect(wall).toHaveLength(1);
    expect(wall[0]).toMatchObject({
      name: "Drake Maye",
      team: { abbr: "NE" },
      entry: { role: "QB", jersey: 10, retiredNumber: true, inductedYear: 2041, lastYear: SAMPLE_START_YEAR },
    });
    expect(wall[0]!.entry.careerSummary?.passYds).toBeGreaterThan(0);
    expect(wall[0]!.entry.careerGames).toBeGreaterThan(0);
    // The second save had no blurb: a save replaces the plaque.
    expect(wall[0]!.entry.blurb).toBeUndefined();

    await owner.mutation(api.hof.entries.remove, { entryId });
    expect(await owner.query(api.hof.entries.wall, {})).toEqual([]);
  });

  test("coaches are inducted by name; bad input is refused", async () => {
    const { owner, maye } = await setup();
    const entryId = await owner.mutation(api.hof.entries.saveStaff, {
      staffName: " Mike Vrabel ",
      role: "Head Coach",
      inductedYear: 2045,
      retiredNumber: true,
      firstYear: 2026,
      lastYear: 2040,
    });
    const [entry] = await owner.query(api.hof.entries.wall, {});
    // A retired number needs a number.
    expect(entry).toMatchObject({
      name: "Mike Vrabel",
      entry: { _id: entryId, role: "Head Coach", retiredNumber: false },
    });
    await expect(
      owner.mutation(api.hof.entries.saveStaff, {
        staffName: "X",
        role: "Coach",
        inductedYear: 2045,
        retiredNumber: false,
        firstYear: 2030,
        lastYear: 2020,
      }),
    ).rejects.toThrow(/first year/);
    await expect(
      owner.mutation(api.hof.entries.inductPlayer, {
        playerId: maye._id,
        inductedYear: 2040,
        jersey: 100,
        retiredNumber: false,
      }),
    ).rejects.toThrow(/0 to 99/);
  });
});

describe("timeline", () => {
  test("game notes, reports and inductions in season order", async () => {
    const { owner, maye, t } = await setup();
    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
    await owner.mutation(api.seasons.reports.saveText, {
      seasonId,
      field: "preseasonThoughts",
      text: "Win now.",
    });
    await owner.mutation(api.seasons.reports.saveText, {
      seasonId,
      field: "postseasonThoughts",
      text: "We did.",
    });
    await owner.mutation(api.hof.entries.inductPlayer, {
      playerId: maye._id,
      inductedYear: 2040,
      retiredNumber: false,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("transactions", {
        franchiseId: active.franchise._id,
        seasonId,
        weekKey: "w4",
        type: "sign",
        playersIn: [{ playerId: maye._id }],
        playersOut: [],
        picksIn: [],
        picksOut: [],
        notes: "Extension talks.",
      });
    });

    const all = await owner.query(api.history.timeline.list, {});
    expect(all.seasons.map((s) => s.year)).toEqual([2027, 2026]);
    expect(all.hasOlder).toBe(false);
    const story = all.entries.filter((e) => e.year === 2026).map((e) => [e.kind, e.title]);
    expect(story).toEqual([
      ["season", "Pre-season report"],
      ["game", "W 31–17 vs LV"],
      ["transaction", "Signed: Drake Maye"],
      ["season", "Post-season report"],
    ]);
    // Inducted long after the last season: shown with the newest season.
    expect(all.entries[0]).toMatchObject({
      kind: "hof",
      year: 2027,
      title: "Hall of Fame: Drake Maye",
      when: "Class of 2040",
    });

    const one = await owner.query(api.history.timeline.list, { seasonId });
    expect(one.entries.every((e) => e.year === 2026)).toBe(true);
    const limited = await owner.query(api.history.timeline.list, { seasonsLimit: 1 });
    expect(limited.hasOlder).toBe(true);
  });
});
