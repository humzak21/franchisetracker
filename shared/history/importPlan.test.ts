import { describe, expect, test } from "vitest";
import { earlierPlan, earlierRange, fullPlan, inRange, parseRange, rangeStep, splitStep } from "./importPlan";

describe("import plan", () => {
  test("steps carry an optional argument", () => {
    expect(splitStep("stats:2014")).toEqual(["stats", "2014"]);
    expect(splitStep("careers")).toEqual(["careers", undefined]);
    expect(rangeStep("players", { from: 1999, to: 2001 })).toBe("players:1999-2001");
    expect(parseRange("1999-2001")).toEqual({ from: 1999, to: 2001 });
    expect(parseRange("2001-1999")).toBeNull();
    expect(parseRange(undefined)).toBeNull();
    expect(inRange(2000, { from: 1999, to: 2001 })).toBe(true);
    expect(inRange(2002, { from: 1999, to: 2001 })).toBe(false);
    expect(inRange(2030, null)).toBe(true);
  });

  test("the full plan imports everything; a franchise before the covered era gets logos", () => {
    expect(fullPlan([2024, 2025])).toEqual([
      "seasons",
      "players",
      "stats:2024",
      "stats:2025",
      "draft",
      "rosters",
      "careers",
      "media",
    ]);
    expect(fullPlan([])).toEqual(["seasons", "media"]);
  });

  test("an import that started in 2002 can add 1999–2001 and nothing else", () => {
    expect(earlierRange(2002)).toEqual({ from: 1999, to: 2001 });
    expect(earlierRange(1999)).toBeNull();
    expect(earlierRange(undefined)).toBeNull();
    expect(earlierPlan({ from: 1999, to: 2001 }, [1999, 2000, 2001])).toEqual([
      "seasons:1999-2001",
      "players:1999-2001",
      "stats:1999",
      "stats:2000",
      "stats:2001",
      "draft:1999-2001",
      "careers",
    ]);
    expect(earlierPlan({ from: 1999, to: 2001 }, [])).toEqual(["seasons:1999-2001"]);
  });
});
