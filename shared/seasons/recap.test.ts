import { describe, expect, test } from "vitest";
import { RECAP_MOVES, recapAwards, recapHeadline, recapMoves } from "./recap";

describe("the recap's headline", () => {
  test("says how the year went", () => {
    expect(
      recapHeadline({
        regular: { w: 12, l: 5, t: 0 },
        divisionRank: 1,
        division: "NFC East",
        seed: 2,
        playoffResult: "div_loss",
      }),
    ).toBe("12-5 · 1st in the NFC East · Seed 2 · Lost Divisional");
  });

  test("leaves out what has not happened", () => {
    expect(
      recapHeadline({
        regular: { w: 3, l: 1, t: 0 },
        divisionRank: null,
        division: "NFC East",
        seed: null,
        playoffResult: null,
      }),
    ).toBe("3-1");
  });
});

describe("the awards a season won", () => {
  test("folds a weekly award won several times, and puts the year's awards first", () => {
    const lines = recapAwards([
      { type: "OPOW", weekKey: "w1", playerId: "a", name: "A" },
      { type: "OPOW", weekKey: "w5", playerId: "a", name: "A" },
      { type: "ProBowl", playerId: "b", name: "B" },
      { type: "MVP", playerId: "a", name: "A" },
    ]);
    expect(lines.map((l) => [l.label, l.count])).toEqual([
      ["Most Valuable Player", 1],
      ["Pro Bowl", 1],
      ["Offensive Player of the Week", 2],
    ]);
  });

  test("a custom award keeps its own name", () => {
    expect(recapAwards([{ type: "custom", customName: "Iron Man", name: "A" }])[0]?.label).toBe("Iron Man");
  });
});

describe("the moves a recap tells", () => {
  test("biggest kind first, in the order they happened, without the injury moves", () => {
    const { shown, total } = recapMoves([
      { id: 1, type: "sign" },
      { id: 2, type: "trade", weekKey: "w6" },
      { id: 3, type: "ir", weekKey: "w2" },
      { id: 4, type: "trade" },
    ]);
    expect(shown.map((m) => m.id)).toEqual([4, 2, 1]);
    expect(total).toBe(3);
  });

  test("stops at the limit and keeps the full count", () => {
    const { shown, total } = recapMoves(
      Array.from({ length: RECAP_MOVES + 3 }, () => ({ type: "sign" as const })),
    );
    expect(shown).toHaveLength(RECAP_MOVES);
    expect(total).toBe(RECAP_MOVES + 3);
  });
});
