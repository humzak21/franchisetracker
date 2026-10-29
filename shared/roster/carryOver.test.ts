import { describe, expect, test } from "vitest";
import { carriedEntry } from "./carryOver";

describe("carriedEntry", () => {
  test("ages the player a year and keeps everything else", () => {
    expect(carriedEntry({ status: "active", age: 24, exp: 2, ovr: 81, jersey: 10 })).toEqual({
      status: "active",
      age: 25,
      exp: 3,
      ovr: 81,
      jersey: 10,
    });
  });

  test("leaves unknown age and experience unknown", () => {
    expect(carriedEntry({ status: "practice_squad" })).toEqual({ status: "practice_squad" });
  });

  test("injured reserve ends with the season", () => {
    expect(carriedEntry({ status: "ir", statusWeekKey: "w9" })).toEqual({ status: "active" });
  });

  test("players who left the team stay behind", () => {
    expect(carriedEntry({ status: "released" })).toBeNull();
    expect(carriedEntry({ status: "traded" })).toBeNull();
  });
});
