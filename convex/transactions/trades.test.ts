/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { blank, seeded } from "./testkit";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  return await seeded(convexTest(schema, modules));
}

describe("recorded trades", () => {
  test("a trade moves players and picks, edits re-apply and deletes undo it", async () => {
    const { owner, seasonId, ne, team, maye, entries, picks, playerNamed } = await setup();
    const kc = await team("KC");
    const tradeId = await owner.mutation(api.transactions.moves.save, {
      ...blank,
      seasonId,
      type: "trade",
      phase: "regular",
      weekKey: "w6",
      teamId: ne,
      counterpartTeamId: kc,
      playersOut: [{ playerId: maye }],
      playersIn: [{ name: "Trade Target", position: "WR", ovr: 84, age: 27 }],
      picksIn: [{ year: 2027, round: 1 }],
      picksOut: [{ year: 2028, round: 2 }],
      notes: "Swing for the fences",
    });

    const mayeEntries = await entries(maye);
    expect(mayeEntries.find((e) => e.teamId === ne)).toMatchObject({ status: "traded", statusWeekKey: "w6" });
    expect(mayeEntries.find((e) => e.teamId === kc)).toMatchObject({
      status: "active",
      jersey: 10,
      position: "QB",
      age: 23,
      partial: true,
      acquisition: {
        type: "trade",
        year: 2026,
        detail: "From NE",
        counterparts: ["Trade Target", "2027 R1"],
      },
    });
    const target = await playerNamed("Trade Target");
    expect(await entries(target)).toMatchObject([
      { teamId: ne, status: "active", ovr: 84, age: 27, acquisition: { detail: "From KC" } },
    ]);
    expect((await picks()).map((p) => [p.year, p.round, p.originTeamId, p.ownerTeamId])).toEqual(
      expect.arrayContaining([
        [2027, 1, kc, ne],
        [2028, 2, ne, kc],
      ]),
    );
    const moves = await owner.query(api.transactions.transactions.bySeason, { seasonId });
    expect(moves.at(-1)).toMatchObject({
      _id: tradeId,
      phase: "regular",
      weekKey: "w6",
      counterpart: { abbr: "KC" },
      playersOut: [{ name: "Drake Maye" }],
      picksIn: [{ year: 2027, round: 1, originTeamId: kc }],
      notes: "Swing for the fences",
    });

    // Keep Maye after all: just the picks change hands.
    await owner.mutation(api.transactions.moves.save, {
      ...blank,
      transactionId: tradeId,
      seasonId,
      type: "trade",
      phase: "draft",
      teamId: ne,
      counterpartTeamId: kc,
      picksIn: [{ year: 2027, round: 1 }],
    });
    expect(await entries(maye)).toMatchObject([{ teamId: ne, status: "active" }]);
    expect((await entries(maye))[0]!.statusWeekKey).toBeUndefined();
    expect(await entries(target)).toEqual([]);
    expect((await picks()).map((p) => [p.year, p.round, p.ownerTeamId])).toEqual([[2027, 1, ne]]);

    await owner.mutation(api.transactions.moves.remove, { transactionId: tradeId });
    expect(await picks()).toEqual([]);
    expect(
      (await owner.query(api.transactions.transactions.bySeason, { seasonId })).map((m) => m._id),
    ).not.toContain(tradeId);
  });

  test("a trade entered from the partner's side is stored from the user team's", async () => {
    const { owner, seasonId, ne, team, maye } = await setup();
    const kc = await team("KC");
    await owner.mutation(api.transactions.moves.save, {
      ...blank,
      seasonId,
      type: "trade",
      phase: "offseason",
      teamId: kc,
      counterpartTeamId: ne,
      playersIn: [{ playerId: maye }],
    });
    const trade = (await owner.query(api.transactions.transactions.bySeason, { seasonId })).find(
      (m) => m.type === "trade" && m.counterpart?.abbr === "KC",
    );
    expect(trade).toMatchObject({
      team: { abbr: "NE" },
      playersOut: [{ name: "Drake Maye" }],
      phase: "offseason",
    });
  });

  test("a pick acquired earlier is the one traded on when the own pick is gone", async () => {
    const { owner, seasonId, ne, team, picks } = await setup();
    const [kc, buf] = [await team("KC"), await team("BUF")];
    const pick = { year: 2029, round: 3 };
    const base = { ...blank, seasonId, type: "trade" as const, phase: "offseason" as const, teamId: ne };
    await owner.mutation(api.transactions.moves.save, { ...base, counterpartTeamId: kc, picksOut: [pick] });
    await owner.mutation(api.transactions.moves.save, { ...base, counterpartTeamId: buf, picksIn: [pick] });
    const id = await owner.mutation(api.transactions.moves.save, {
      ...base,
      counterpartTeamId: kc,
      picksOut: [pick],
    });
    const rows = await picks();
    expect(rows.map((r) => [r.originTeamId, r.ownerTeamId])).toEqual(
      expect.arrayContaining([
        [ne, kc],
        [buf, kc],
      ]),
    );
    const moves = await owner.query(api.transactions.transactions.bySeason, { seasonId });
    expect(moves.find((m) => m._id === id)?.picksOut).toMatchObject([{ origin: "BUF" }]);
  });
});
