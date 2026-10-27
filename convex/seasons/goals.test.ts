/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
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
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR)!._id;
  const playerId = async (lastName: string) =>
    await t.run(async (ctx) => {
      const player = await ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_lastName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("lastName", lastName),
        )
        .first();
      return player!._id;
    });
  return { t, owner, active, seasonId, playerId };
}

const statuses = (list: { goals: { evaluation: { status: string } }[] } | null) =>
  list?.goals.map((g) => g.evaluation.status);

describe("season goals", () => {
  test("team and player goals are judged against the season as it stands", async () => {
    const { owner, seasonId, playerId } = await setup();
    const maye = await playerId("Maye");
    // The sample season is 4-1 in the regular season, in progress.
    await owner.mutation(api.seasons.goals.add, { seasonId, scope: "team", type: "wins", target: 4 });
    await owner.mutation(api.seasons.goals.add, { seasonId, scope: "team", type: "wins", target: 12 });
    await owner.mutation(api.seasons.goals.add, { seasonId, scope: "team", type: "super_bowl_win" });
    await owner.mutation(api.seasons.goals.add, {
      seasonId,
      scope: "player",
      type: "stat",
      playerId: maye,
      statKey: "passYds",
      target: 1000,
    });
    await owner.mutation(api.seasons.goals.add, {
      seasonId,
      scope: "player",
      type: "stat",
      playerId: maye,
      statKey: "passInt",
      target: 2,
    });
    await owner.mutation(api.seasons.goals.add, {
      seasonId,
      scope: "team",
      type: "custom",
      text: "  Sweep the division  ",
    });

    const list = await owner.query(api.seasons.goals.list, { seasonId });
    expect(statuses(list)).toEqual(["hit", "in_progress", "in_progress", "hit", "missed", "pending"]);
    expect(list!.goals[1]!.evaluation.progress).toEqual({ current: 4, target: 12, better: "higher" });
    expect(list!.goals[3]!.player?.displayName).toMatch(/Maye/);
    expect(list!.goals[3]!.evaluation.progress?.current).toBe(1403);
    expect(list!.goals[5]!.goal.text).toBe("Sweep the division");
    expect(list!.goals.map((g) => g.goal.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("edit, mark by hand, reorder and remove", async () => {
    const { owner, seasonId } = await setup();
    const first = await owner.mutation(api.seasons.goals.add, { seasonId, scope: "team", type: "playoffs" });
    const second = await owner.mutation(api.seasons.goals.add, {
      seasonId,
      scope: "team",
      type: "custom",
      text: "Beat Buffalo",
    });

    await owner.mutation(api.seasons.goals.setOutcome, { goalId: second, outcome: "hit" });
    await owner.mutation(api.seasons.goals.move, { goalId: second, direction: -1 });
    // Already at the top: nothing moves.
    await owner.mutation(api.seasons.goals.move, { goalId: second, direction: -1 });
    let list = await owner.query(api.seasons.goals.list, { seasonId });
    expect(list!.goals.map((g) => [g.goal._id, g.evaluation.status, g.evaluation.manual])).toEqual([
      [second, "hit", true],
      [first, "in_progress", false],
    ]);

    await owner.mutation(api.seasons.goals.update, {
      goalId: second,
      scope: "team",
      type: "custom",
      text: "Beat Buffalo twice",
    });
    await owner.mutation(api.seasons.goals.update, { goalId: first, scope: "team", type: "wins", target: 3 });
    list = await owner.query(api.seasons.goals.list, { seasonId });
    expect(list!.goals.map((g) => [g.goal.text, g.goal.outcome, g.evaluation.status])).toEqual([
      ["Beat Buffalo twice", "hit", "hit"],
      [undefined, undefined, "hit"],
    ]);

    await owner.mutation(api.seasons.goals.setOutcome, { goalId: second, outcome: null });
    await owner.mutation(api.seasons.goals.remove, { goalId: first });
    expect(statuses(await owner.query(api.seasons.goals.list, { seasonId }))).toEqual(["pending"]);
  });

  test("refuses bad goals, players off the roster and seasons before the franchise", async () => {
    const { t, owner, active, seasonId, playerId } = await setup();
    const add = (args: Omit<FunctionArgs<typeof api.seasons.goals.add>, "seasonId">, id = seasonId) =>
      owner.mutation(api.seasons.goals.add, { seasonId: id, ...args });
    await expect(add({ scope: "team", type: "wins" })).rejects.toThrow(/whole number/);
    await expect(add({ scope: "team", type: "custom", text: " " })).rejects.toThrow(/Write the goal in/);
    await expect(
      add({ scope: "player", type: "stat", playerId: await playerId("Maye"), statKey: "nope", target: 1 }),
    ).rejects.toThrow(/Pick a stat/);

    const stranger: Id<"players"> = await t.run((ctx) =>
      ctx.db.insert("players", {
        franchiseId: active.franchise._id,
        firstName: "Free",
        lastName: "Agent",
        displayName: "Free Agent",
        position: "QB",
        isReal: false,
        retired: false,
        aliases: [],
      }),
    );
    await expect(
      add({ scope: "player", type: "stat", playerId: stranger, statKey: "passYds", target: 1 }),
    ).rejects.toThrow(/roster/);

    const history = active.seasons.find((s) => s.year < SAMPLE_START_YEAR);
    if (history) {
      await expect(add({ scope: "team", type: "playoffs" }, history._id)).rejects.toThrow(/real NFL history/);
      expect(await owner.query(api.seasons.goals.list, { seasonId: history._id })).toBeNull();
    }
  });

  test("only the owner may read or change goals", async () => {
    const { t, owner, seasonId } = await setup();
    const goalId = await owner.mutation(api.seasons.goals.add, { seasonId, scope: "team", type: "playoffs" });
    const stranger = await asStranger(t);
    await expect(stranger.query(api.seasons.goals.list, { seasonId })).rejects.toThrow(/Not the owner/);
    await expect(
      stranger.mutation(api.seasons.goals.add, { seasonId, scope: "team", type: "playoffs" }),
    ).rejects.toThrow(/Not the owner/);
    await expect(stranger.mutation(api.seasons.goals.remove, { goalId })).rejects.toThrow(/Not the owner/);
    await expect(stranger.mutation(api.seasons.goals.setOutcome, { goalId, outcome: "hit" })).rejects.toThrow(
      /Not the owner/,
    );
  });
});
