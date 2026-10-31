import { describe, expect, test } from "vitest";
import { depthSlots, isWholeRoster, offThePage } from "./rosterPage";

describe("isWholeRoster", () => {
  test("a full page is the whole team unless it says otherwise", () => {
    expect(isWholeRoster(53, false)).toBe(true);
    expect(isWholeRoster(53, true)).toBe(false);
  });

  test("a short page never is", () => {
    expect(isWholeRoster(12, false)).toBe(false);
  });
});

describe("offThePage", () => {
  const entry = (playerId: string, status: "active" | "ir" | "practice_squad" | "released" | "unsigned") => ({
    playerId,
    status,
  });

  test("anyone on the roster the page does not list", () => {
    const entries = [entry("a", "active"), entry("b", "ir"), entry("c", "unsigned"), entry("d", "active")];
    expect(offThePage(entries, new Set(["d"])).map((e) => e.playerId)).toEqual(["a", "b", "c"]);
  });

  test("leaves the practice squad and anyone already gone", () => {
    const entries = [entry("a", "practice_squad"), entry("b", "released")];
    expect(offThePage(entries, new Set())).toEqual([]);
  });
});

test("depthSlots counts each position in page order", () => {
  expect(depthSlots(["QB", "WR", "QB", null, "WR", "WR"])).toEqual([1, 1, 2, undefined, 2, 3]);
});
