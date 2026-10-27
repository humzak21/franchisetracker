import { describe, expect, it } from "vitest";
import { formFromPlayer, patchFromForm } from "./playerForm";

const player = {
  firstName: "Drake",
  lastName: "Maye",
  displayName: "Drake Maye",
  position: "QB" as const,
  ageAnchor: { age: 23, year: 2026 },
  heightIn: 76,
  draft: { year: 2024, round: 1, pick: 3, teamId: "ne" },
  retired: false,
};

describe("player form", () => {
  const form = formFromPlayer(player, 2027);

  it("fills the fields from the player", () => {
    expect(form).toMatchObject({ age: "24", feet: "6", inches: "4", draftPick: "3", draftTeamId: "ne" });
  });

  it("round-trips without touching the names", () => {
    const result = patchFromForm(form, form, 2027);
    expect(result).toEqual({
      ok: true,
      fields: {
        position: "QB",
        birthYear: null,
        ageAnchor: { age: 24, year: 2027 },
        college: "",
        heightIn: 76,
        weightLb: null,
        draft: { year: 2024, round: 1, pick: 3, teamId: "ne" },
        undrafted: false,
        retired: false,
      },
    });
  });

  it("sends only the names that changed", () => {
    const result = patchFromForm({ ...form, displayName: "D. Maye" }, form, 2027);
    expect(result.ok && result.fields).toMatchObject({ displayName: "D. Maye" });
    expect(result.ok && "firstName" in result.fields).toBe(false);
  });

  it("drops the age anchor for a birth year and the draft for undrafted", () => {
    const result = patchFromForm({ ...form, birthYear: "2002", undrafted: true }, form, 2027);
    expect(result.ok && result.fields).toMatchObject({ birthYear: 2002, draft: null, undrafted: true });
    expect(result.ok && "ageAnchor" in result.fields).toBe(false);
  });

  it("needs a year and a round for a draft slot", () => {
    expect(patchFromForm({ ...form, draftRound: "" }, form, 2027)).toMatchObject({ ok: false });
  });
});
