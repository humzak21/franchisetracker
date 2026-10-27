import { describe, expect, it } from "vitest";
import { cleanStars, MAX_STARS, moveItem } from "./stars";

describe("cleanStars", () => {
  it("keeps order, trims captions and drops a typed name when a player is linked", () => {
    const out = cleanStars([
      { playerId: "p1", rawName: "ignored", caption: "  3 TD  ", teamId: "t1" },
      { rawName: "  Opponent LB ", caption: "   " },
    ]);
    expect(out).toEqual({
      ok: true,
      value: [{ playerId: "p1", teamId: "t1", caption: "3 TD" }, { rawName: "Opponent LB" }],
    });
  });

  it("allows any number up to the cap, and none", () => {
    expect(cleanStars([])).toEqual({ ok: true, value: [] });
    const many = Array.from({ length: MAX_STARS + 1 }, (_, i) => ({ rawName: `P${i}` }));
    expect(cleanStars(many).ok).toBe(false);
    expect(cleanStars(many.slice(0, 7)).ok).toBe(true);
  });

  it("refuses blank stars, duplicates and long text", () => {
    expect(cleanStars([{ rawName: "  " }]).ok).toBe(false);
    expect(cleanStars([{ playerId: "p1" }, { playerId: "p1" }]).ok).toBe(false);
    expect(cleanStars([{ rawName: "x".repeat(61) }]).ok).toBe(false);
    expect(cleanStars([{ rawName: "A", caption: "x".repeat(121) }]).ok).toBe(false);
  });
});

describe("moveItem", () => {
  it("moves an item up or down and ignores out-of-range moves", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});
