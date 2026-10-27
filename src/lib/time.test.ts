import { describe, expect, it } from "vitest";
import { formatAge, formatElapsed } from "./time";

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

describe("formatElapsed", () => {
  const now = Date.UTC(2026, 9, 26, 12);
  it("counts seconds, then minutes, then hours", () => {
    expect(formatElapsed(now - 12_000, now)).toBe("12s");
    expect(formatElapsed(now - 4 * 60_000 - 5_000, now)).toBe("4 min");
    expect(formatElapsed(now - 60 * 60_000, now)).toBe("1 h");
    expect(formatElapsed(now - 65 * 60_000, now)).toBe("1 h 5 min");
    expect(formatElapsed(now + 5_000, now)).toBe("0s");
  });
});
