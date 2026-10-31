import { describe, expect, it } from "vitest";
import { budgetLevel, usageMonth } from "./budget";

describe("budgetLevel", () => {
  it("has nothing to say without a budget", () => {
    expect(budgetLevel(500, undefined)).toBe("none");
    expect(budgetLevel(500, 0)).toBe("none");
  });

  it("warns at 80 percent and stops at the limit", () => {
    expect(budgetLevel(7.99, 10)).toBe("ok");
    expect(budgetLevel(8, 10)).toBe("warn");
    expect(budgetLevel(10, 10)).toBe("over");
  });
});

describe("usageMonth", () => {
  it("is the UTC month", () => {
    expect(usageMonth(Date.UTC(2026, 9, 31, 23, 59))).toBe("2026-10");
    expect(usageMonth(Date.UTC(2026, 10, 1, 0, 1))).toBe("2026-11");
  });
});
