import { describe, expect, it } from "vitest";
import { MAX_STARS, cleanStars, moveItem, toggleStar } from "./stars";

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

describe("toggleStar", () => {
  type Star = { playerId?: string; rawName?: string; caption?: string };
  const a: Star = { playerId: "a" };
  const b: Star = { playerId: "b", caption: "note" };
  const typed: Star = { rawName: "Opponent standout" };

  it("a player who is not a star joins at the end", () => {
    expect(toggleStar([a, typed], "b", b)).toEqual([a, typed, b]);
  });

  it("a star is taken out, the rest keep their order", () => {
    expect(toggleStar([a, b, typed], "a", a)).toEqual([b, typed]);
  });

  it("a full list takes no one new, but still lets a star go", () => {
    const full = Array.from({ length: MAX_STARS }, (_, i) => ({ playerId: `p${i}` }));
    expect(toggleStar(full, "new", { playerId: "new" })).toBeNull();
    expect(toggleStar(full, "p0", { playerId: "p0" })).toHaveLength(MAX_STARS - 1);
  });
});
