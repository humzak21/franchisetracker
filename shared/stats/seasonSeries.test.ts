import { describe, expect, it } from "vitest";
import { isBestSeason, previousSeason, seasonBars } from "./seasonSeries";

describe("seasonBars", () => {
  it("measures positive values from a zero line at the bottom", () => {
    const { zero, bars } = seasonBars([20, 40]);
    expect(zero).toBe(0);
    expect(bars).toEqual([
      { bottom: 0, height: 50 },
      { bottom: 0, height: 100 },
    ]);
  });

  it("hangs negative values below a raised zero line", () => {
    const { zero, bars } = seasonBars([-5, 15]);
    expect(zero).toBe(25);
    expect(bars).toEqual([
      { bottom: 0, height: 25 },
      { bottom: 25, height: 75 },
    ]);
  });

  it("keeps all-zero seasons flat without dividing by zero", () => {
    expect(seasonBars([0, 0]).bars).toEqual([
      { bottom: 0, height: 0 },
      { bottom: 0, height: 0 },
    ]);
  });
});

describe("previousSeason", () => {
  const points = [
    { year: 2026, value: 1 },
    { year: 2028, value: 3 },
  ];

  it("finds the latest earlier season, skipping gaps", () => {
    expect(previousSeason(points, 2029)?.year).toBe(2028);
    expect(previousSeason(points, 2028)?.year).toBe(2026);
  });

  it("is null for the first season", () => {
    expect(previousSeason(points, 2026)).toBeNull();
  });
});

describe("isBestSeason", () => {
  const points = [
    { year: 2026, value: 26.4 },
    { year: 2027, value: 24.9 },
    { year: 2028, value: 35 },
  ];

  it("follows the stat's good direction", () => {
    expect(isBestSeason(points, 2028, "higher")).toBe(true);
    expect(isBestSeason(points, 2027, "lower")).toBe(true);
    expect(isBestSeason(points, 2028, "lower")).toBe(false);
  });

  it("needs enough seasons and a value for the year", () => {
    expect(isBestSeason(points.slice(1), 2028, "higher")).toBe(false);
    expect(isBestSeason(points, 2029, "higher")).toBe(false);
  });
});
