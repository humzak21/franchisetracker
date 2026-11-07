import { describe, expect, it } from "vitest";
import { seasonWeekKey, seasonYear, weekKeyOf } from "./calendar";

describe("weekKeyOf", () => {
  it("maps Madden's 0-based weeks onto the app's week keys", () => {
    expect(weekKeyOf("PreSeason", 0)).toBe("pre1");
    expect(weekKeyOf("RegularSeason", 0)).toBe("w1");
    expect(weekKeyOf("RegularSeason", 17)).toBe("w18");
    expect(weekKeyOf("WildcardPlayoff", 18)).toBe("wc");
    expect(weekKeyOf("DivisionalPlayoff", 19)).toBe("div");
    expect(weekKeyOf("ConferencePlayoff", 20)).toBe("conf");
    expect(weekKeyOf("SuperBowl", 22)).toBe("sb");
  });

  it("has no slot for a fourth preseason week, a 19th regular week or an unknown type", () => {
    expect(weekKeyOf("PreSeason", 3)).toBeNull();
    expect(weekKeyOf("RegularSeason", 18)).toBeNull();
    expect(weekKeyOf("OffSeason", 0)).toBeNull();
  });
});

describe("seasonWeekKey", () => {
  it("runs the regular season into the playoffs", () => {
    expect(seasonWeekKey(2)).toBe("w3");
    expect(seasonWeekKey(18)).toBe("wc");
    expect(seasonWeekKey(21)).toBe("probowl");
    expect(seasonWeekKey(22)).toBe("sb");
    expect(seasonWeekKey(23)).toBeNull();
  });
});

it("seasonYear counts from the franchise's first season", () => {
  expect(seasonYear(2026, 2)).toBe(2028);
});
