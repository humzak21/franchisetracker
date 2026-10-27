import { describe, expect, it } from "vitest";
import { validGameStat, withStat } from "./statEdit";

describe("statEdit", () => {
  it("accepts whole, half and negative numbers within the ceiling", () => {
    expect(validGameStat(3)).toBe(true);
    expect(validGameStat(1.5)).toBe(true);
    expect(validGameStat(-4)).toBe(true);
    expect(validGameStat(0.3)).toBe(false);
    expect(validGameStat(Number.NaN)).toBe(false);
    expect(validGameStat(100_000)).toBe(false);
  });

  it("sets and clears one key without touching the input", () => {
    const stats = { passYds: 250, passTd: 2 };
    expect(withStat(stats, "passTd", 3)).toEqual({ passYds: 250, passTd: 3 });
    expect(withStat(stats, "passYds", null)).toEqual({ passTd: 2 });
    expect(stats).toEqual({ passYds: 250, passTd: 2 });
  });
});
