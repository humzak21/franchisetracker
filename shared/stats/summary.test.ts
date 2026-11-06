import { describe, expect, it } from "vitest";
import { summarize } from "./summary";

describe("summarize", () => {
  it("is null for no values", () => {
    expect(summarize([])).toBeNull();
  });

  it("works out the centre, spread and extremes", () => {
    const s = summarize([40, 0, 120, 40, 60]);
    expect(s).toMatchObject({ count: 5, total: 260, mean: 52, median: 40, mode: 40, modeCount: 2 });
    expect(s).toMatchObject({ max: 120, maxAt: 2, min: 0, minAt: 1 });
    expect(s?.stdDev).toBeCloseTo(39.19, 2);
  });

  it("averages the middle two for an even count", () => {
    expect(summarize([1, 4, 2, 3])?.median).toBe(2.5);
  });

  it("has no mode when no value repeats, and takes the lowest on a tie", () => {
    expect(summarize([3, 1, 2])).toMatchObject({ mode: null, modeCount: 0 });
    expect(summarize([2, 1, 2, 1, 5])).toMatchObject({ mode: 1, modeCount: 2 });
  });

  it("points at the first game at the high and the low", () => {
    expect(summarize([7, 9, 7, 9])).toMatchObject({ maxAt: 1, minAt: 0 });
  });

  it("handles one value", () => {
    expect(summarize([0.5])).toMatchObject({ mean: 0.5, median: 0.5, stdDev: 0, mode: null });
  });
});
