import { describe, expect, test } from "vitest";
import { byDepth, depthChart, moved } from "./depth";

describe("byDepth", () => {
  test("slots lead, then the best rating", () => {
    const rows = [{ ovr: 90 }, { depthSlot: 2, ovr: 70 }, { depthSlot: 1, ovr: 60 }, { ovr: 95 }];
    expect([...rows].sort(byDepth).map((r) => r.ovr)).toEqual([60, 70, 95, 90]);
  });
});

test("depthChart groups by position in roster order", () => {
  const chart = depthChart(
    [
      { position: "WR" as const, ovr: 80 },
      { position: "QB" as const, ovr: 70 },
      { position: "WR" as const, ovr: 90 },
    ],
    (r) => r,
  );
  expect(chart.map((g) => g.position)).toEqual(["QB", "WR"]);
  expect(chart[1]?.rows.map((r) => r.ovr)).toEqual([90, 80]);
});

describe("moved", () => {
  test("swaps with the neighbor", () => {
    expect(moved(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  test("stays put at either end", () => {
    expect(moved(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moved(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });
});
