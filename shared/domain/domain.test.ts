import { describe, expect, it } from "vitest";
import { NFL_TEAMS, adjacentWeek, currentNflSeason, normalizePosition, weekLabel, weekPhase } from "./index";

describe("positions", () => {
  it("normalizes Madden and legacy spellings", () => {
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
    expect(weekPhase("wc")).toBe("postseason");
    expect(weekLabel("wc")).toBe("WC");
    expect(weekLabel("w10", "long")).toBe("Week 10");
    expect(adjacentWeek("w18", 1)).toBe("wc");
    expect(adjacentWeek("pre1", -1)).toBeNull();
  });
});

describe("currentNflSeason", () => {
  it("names the season for the year it kicks off, turning over in March", () => {
    expect(currentNflSeason(new Date(2026, 9, 26))).toBe(2026);
    expect(currentNflSeason(new Date(2027, 1, 10))).toBe(2026);
    expect(currentNflSeason(new Date(2027, 2, 1))).toBe(2027);
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
