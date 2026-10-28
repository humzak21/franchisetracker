import { describe, expect, it } from "vitest";
import { lineScoreError, periodLabel } from "./lineScore";

describe("periodLabel", () => {
  it("numbers quarters and counts overtimes", () => {
    expect([0, 3, 4, 5].map(periodLabel)).toEqual(["1", "4", "OT", "2OT"]);
  });
});

describe("lineScoreError", () => {
  const final = { home: 24, away: 17 };
  it("accepts quarters that add up to the final", () => {
    expect(lineScoreError({ home: [7, 7, 3, 7], away: [0, 10, 7, 0] }, final)).toBeNull();
  });
  it("accepts overtime periods", () => {
    expect(lineScoreError({ home: [7, 7, 3, 1, 6], away: [0, 10, 7, 0, 0] }, final)).toBeNull();
  });
  it("names the side that doesn't add up", () => {
    expect(lineScoreError({ home: [7, 7, 3, 7], away: [0, 10, 7, 3] }, final)).toMatch(/away .* 20/);
  });
  it("needs four quarters on both sides", () => {
    expect(lineScoreError({ home: [7, 7, 10], away: [0, 10, 7] }, final)).toMatch(/four quarters/);
    expect(lineScoreError({ home: [7, 7, 3, 7], away: [0, 10, 7] }, final)).toMatch(/same number/);
  });
  it("rejects negative or fractional points", () => {
    expect(lineScoreError({ home: [7, 7, 3, 7], away: [0, 10, 7.5, -0.5] }, final)).toMatch(/whole/);
  });
  it("skips the sum check when there is no final yet", () => {
    expect(lineScoreError({ home: [7, 0, 0, 0], away: [0, 0, 0, 0] }, { home: null, away: null })).toBeNull();
  });
});
