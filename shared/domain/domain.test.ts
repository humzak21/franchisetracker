import { describe, expect, it } from "vitest";
import { NFL_TEAMS, adjacentWeek, normalizePosition, weekLabel, weekPhase } from "./index";

describe("positions", () => {
  it("normalizes workbook spellings", () => {
    expect(normalizePosition("LEDGE")).toBe("LEDG");
    expect(normalizePosition("SS/LB")).toBe("SS");
    expect(normalizePosition("rb")).toBe("HB");
    expect(normalizePosition("??")).toBeNull();
  });
});

describe("calendar", () => {
  it("labels and orders weeks", () => {
    expect(weekLabel("w7")).toBe("W7");
    expect(weekLabel("sb", "long")).toBe("Super Bowl");
    expect(weekPhase("div")).toBe("postseason");
    expect(adjacentWeek("w18", 1)).toBe("wc");
    expect(adjacentWeek("pre1", -1)).toBeNull();
  });
});

describe("teams", () => {
  it("has 32 teams, 4 per division", () => {
    expect(NFL_TEAMS).toHaveLength(32);
    const byDivision = new Map<string, number>();
    for (const t of NFL_TEAMS)
      byDivision.set(
        `${t.conference} ${t.division}`,
        (byDivision.get(`${t.conference} ${t.division}`) ?? 0) + 1,
      );
    expect([...byDivision.values()].every((n) => n === 4)).toBe(true);
    expect(new Set(NFL_TEAMS.map((t) => t.abbr)).size).toBe(32);
  });
});
