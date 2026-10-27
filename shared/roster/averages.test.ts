import { describe, expect, it } from "vitest";
import { mean, onRoster, rosterAverages, type AverageRow } from "./averages";

const row = (over: Partial<AverageRow>): AverageRow => ({
  position: "QB",
  status: "active",
  age: null,
  ovr: null,
  exp: null,
  ...over,
});

describe("mean", () => {
  it("rounds to one decimal", () => {
    expect(mean([80, 81, 81])).toBe(80.7);
  });
  it("skips missing values and returns null when none are known", () => {
    expect(mean([70, null, undefined, 80])).toBe(75);
    expect(mean([null, undefined])).toBeNull();
    expect(mean([])).toBeNull();
  });
});

describe("onRoster", () => {
  it("drops released and traded players", () => {
    expect(onRoster("active")).toBe(true);
    expect(onRoster("ir")).toBe(true);
    expect(onRoster("practice_squad")).toBe(true);
    expect(onRoster("released")).toBe(false);
    expect(onRoster("traded")).toBe(false);
  });
});

describe("rosterAverages", () => {
  const rows = [
    row({ position: "QB", age: 23, ovr: 79, exp: 1 }),
    row({ position: "WR", age: 32, ovr: 86, exp: 10 }),
    row({ position: "MLB", age: 26, ovr: 80, exp: null }),
    row({ position: "CB", age: 27, ovr: null, exp: 5 }),
    row({ position: "K", age: 30, ovr: 75, exp: 8 }),
    row({ position: "WR", age: 40, ovr: 99, exp: 20, status: "released" }),
    row({ position: "DT", age: 40, ovr: 99, exp: 20, status: "traded" }),
  ];
  const averages = rosterAverages(rows);

  it("averages the whole team without players who left", () => {
    expect(averages.team).toEqual({ count: 5, age: 27.6, ovr: 80, exp: 6 });
  });
  it("splits by side of the ball", () => {
    expect(averages.offense).toEqual({ count: 2, age: 27.5, ovr: 82.5, exp: 5.5 });
    expect(averages.defense).toEqual({ count: 2, age: 26.5, ovr: 80, exp: 5 });
    expect(averages.special).toEqual({ count: 1, age: 30, ovr: 75, exp: 8 });
  });
  it("is empty for an empty roster", () => {
    expect(rosterAverages([]).team).toEqual({ count: 0, age: null, ovr: null, exp: null });
  });
});
