import { describe, expect, it } from "vitest";
import { acquisitionLabel } from "./acquisition";

const NE = "team-ne";
const PHI = "team-phi";
const drafted = { year: 2027, round: 1, pick: 1, teamId: NE };

describe("acquisitionLabel", () => {
  it("shows the draft slot for a player the user team drafted", () => {
    expect(acquisitionLabel({ type: "draft" }, drafted, NE)).toBe("Rd 1, Pick 1 · 2027");
    expect(acquisitionLabel(undefined, drafted, NE)).toBe("Rd 1, Pick 1 · 2027");
    expect(acquisitionLabel({ type: "resign" }, drafted, NE)).toBe("Rd 1, Pick 1 · 2027");
  });

  it("leaves the pick out when only the round is known", () => {
    expect(acquisitionLabel(undefined, { year: 2027, round: 3, teamId: NE }, NE)).toBe("Rd 3 · 2027");
  });

  it("keeps a later route back to the team", () => {
    expect(acquisitionLabel({ type: "free_agent" }, drafted, NE)).toBe("Free agent");
    expect(acquisitionLabel({ type: "trade" }, drafted, NE)).toBe("Trade");
  });

  it("keeps the entry's type for players another team drafted", () => {
    expect(acquisitionLabel({ type: "free_agent" }, { ...drafted, teamId: PHI }, NE)).toBe("Free agent");
    expect(acquisitionLabel({ type: "draft" }, { ...drafted, teamId: PHI }, NE)).toBe("Drafted");
    expect(acquisitionLabel(undefined, { ...drafted, teamId: PHI }, NE)).toBeNull();
    expect(acquisitionLabel(undefined, undefined, NE)).toBeNull();
  });
});
