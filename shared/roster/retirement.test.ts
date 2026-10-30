import { describe, expect, test } from "vitest";
import { retirementAge, suggestsRetirement } from "./retirement";

const veteran = { position: "WR" as const, age: 35, status: "active" as const, retired: false };

describe("suggestsRetirement", () => {
  test("an older player only carried over", () => {
    expect(suggestsRetirement({ ...veteran, lastSeenYear: 2026 }, 2027)).toBe(true);
    expect(suggestsRetirement(veteran, 2027)).toBe(true);
  });

  test("not once a commit this season has named him", () => {
    expect(suggestsRetirement({ ...veteran, lastSeenYear: 2027 }, 2027)).toBe(false);
  });

  test("not the young, the gone or the retired", () => {
    expect(suggestsRetirement({ ...veteran, age: 30 }, 2027)).toBe(false);
    expect(suggestsRetirement({ ...veteran, status: "released" }, 2027)).toBe(false);
    expect(suggestsRetirement({ ...veteran, retired: true }, 2027)).toBe(false);
  });

  test("quarterbacks and specialists last longer", () => {
    expect(retirementAge("QB")).toBeGreaterThan(retirementAge("WR"));
    expect(suggestsRetirement({ ...veteran, position: "K", age: 36 }, 2027)).toBe(false);
    expect(suggestsRetirement({ ...veteran, position: "K", age: 38 }, 2027)).toBe(true);
  });
});
