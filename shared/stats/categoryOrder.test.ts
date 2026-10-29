import { describe, expect, it } from "vitest";
import { categoriesForPosition } from "./categories";
import { RAW_STAT_CATEGORIES } from "./registry";

const all = [...RAW_STAT_CATEGORIES, "fantasy"] as const;

describe("categoriesForPosition", () => {
  it("leads with each skill position's main stats, fantasy right after", () => {
    expect(categoriesForPosition("WR", all).slice(0, 3)).toEqual(["receiving", "fantasy", "rushing"]);
    expect(categoriesForPosition("TE", all).slice(0, 3)).toEqual(["receiving", "fantasy", "rushing"]);
    expect(categoriesForPosition("RB", all).slice(0, 3)).toEqual(["rushing", "fantasy", "receiving"]);
    expect(categoriesForPosition("QB", all).slice(0, 3)).toEqual(["passing", "fantasy", "rushing"]);
  });

  it("keeps every category once, the player's own before the rest", () => {
    const wr = categoriesForPosition("WR", all);
    expect([...wr].sort()).toEqual([...all].sort());
    // Returns are a receiver's own; passing and defense are not.
    expect(wr.indexOf("returns")).toBeLessThan(wr.indexOf("passing"));
  });

  it("leaves fantasy last for everyone else, and out when it was not asked for", () => {
    expect(categoriesForPosition("LB", all).at(-1)).toBe("fantasy");
    expect(categoriesForPosition("LB", all)[0]).toBe("defense");
    expect(categoriesForPosition("RB", ["receiving", "rushing"])).toEqual(["rushing", "receiving"]);
  });
});
