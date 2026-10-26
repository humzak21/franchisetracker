import { describe, expect, it } from "vitest";
import { ageInSeason, formatAcquisition, formatDraft, formatHeight, positionOrder } from "./format";

describe("formatAcquisition", () => {
  it("labels the type and year", () => {
    expect(formatAcquisition({ type: "draft", year: 2024 })).toBe("Drafted 2024");
    expect(formatAcquisition({ type: "free_agent", year: 2025 })).toBe("Free agent 2025");
    expect(formatAcquisition({ type: "trade" })).toBe("Trade");
  });
  it("returns null when unknown", () => {
    expect(formatAcquisition(undefined)).toBeNull();
  });
});

describe("ageInSeason", () => {
  it("uses the birth year", () => {
    expect(ageInSeason({ birthYear: 2002 }, 2027)).toBe(25);
  });
  it("projects from an age anchor", () => {
    expect(ageInSeason({ ageAnchor: { age: 23, year: 2025 } }, 2028)).toBe(26);
  });
  it("returns null without data", () => {
    expect(ageInSeason({}, 2025)).toBeNull();
  });
});

describe("positionOrder", () => {
  it("orders offense before defense before specialists", () => {
    expect(positionOrder("QB")).toBeLessThan(positionOrder("WR"));
    expect(positionOrder("WR")).toBeLessThan(positionOrder("CB"));
    expect(positionOrder("CB")).toBeLessThan(positionOrder("K"));
  });
});

describe("bio formatting", () => {
  it("formats height and the draft slot", () => {
    expect(formatHeight(76)).toBe(`6'4"`);
    expect(formatHeight(undefined)).toBeNull();
    expect(formatDraft({ year: 2024, round: 1, pick: 3 }, "NE")).toBe("2024 · Rd 1, #3 NE");
    expect(formatDraft(undefined, null, true)).toBe("Undrafted");
    expect(formatDraft(undefined, null)).toBeNull();
  });
});
