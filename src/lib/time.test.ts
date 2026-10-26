import { describe, expect, it } from "vitest";
import { formatAge } from "./time";

describe("formatAge", () => {
  const now = Date.UTC(2026, 9, 26, 12);
  it("reads like a feed", () => {
    expect(formatAge(now - 20_000, now)).toBe("just now");
    expect(formatAge(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatAge(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatAge(now - 2 * 86_400_000, now)).toBe("2d ago");
    expect(formatAge(Date.UTC(2026, 8, 1, 12), now)).toBe("Sep 1");
  });
});
