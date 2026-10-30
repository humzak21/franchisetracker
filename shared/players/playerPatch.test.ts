import { describe, expect, it } from "vitest";
import { applyPlayerPatch, type PlayerFields } from "./playerPatch";

const player: PlayerFields = {
  firstName: "Stefon",
  lastName: "Diggs",
  displayName: "Stefon Diggs",
  aliases: ["S. Diggs"],
  position: "WR",
  college: "Maryland",
  undrafted: true,
  retired: false,
};

describe("applyPlayerPatch", () => {
  it("renames from a display name, keeping the old name as an alias", () => {
    expect(applyPlayerPatch(player, { displayName: "  Amon-Ra  St. Brown " })).toEqual({
      ok: true,
      fields: {
        aliasesText: "S. Diggs Stefon Diggs",
        firstName: "Amon-Ra",
        lastName: "St. Brown",
        displayName: "Amon-Ra St. Brown",
        aliases: ["S. Diggs", "Stefon Diggs"],
      },
    });
  });

  it("edits first and last names without touching the display name", () => {
    expect(applyPlayerPatch(player, { firstName: "Stef" })).toEqual({
      ok: true,
      fields: { firstName: "Stef", lastName: "Diggs", displayName: "Stefon Diggs" },
    });
    expect(applyPlayerPatch(player, { lastName: " " })).toMatchObject({ ok: false });
  });

  it("validates bio numbers", () => {
    expect(applyPlayerPatch(player, { heightIn: 30 })).toMatchObject({ ok: false, error: /Height/ });
    expect(applyPlayerPatch(player, { birthYear: 1998.5 })).toMatchObject({ ok: false });
    expect(applyPlayerPatch(player, { ageAnchor: { age: 99, year: 2026 } })).toMatchObject({ ok: false });
    expect(applyPlayerPatch(player, { heightIn: 72, weightLb: null })).toEqual({
      ok: true,
      fields: { heightIn: 72, weightLb: undefined },
    });
  });

  it("clears empty text", () => {
    expect(applyPlayerPatch(player, { college: "  " })).toEqual({ ok: true, fields: { college: undefined } });
  });

  it("keeps the draft slot and undrafted consistent", () => {
    expect(applyPlayerPatch(player, { draft: { year: 2015, round: 5, pick: 146 } })).toEqual({
      ok: true,
      fields: { draft: { year: 2015, round: 5, pick: 146 }, undrafted: undefined },
    });
    expect(applyPlayerPatch(player, { undrafted: true })).toEqual({
      ok: true,
      fields: { undrafted: true, draft: undefined },
    });
    expect(applyPlayerPatch(player, { draft: { year: 2015, round: 0 } })).toMatchObject({ ok: false });
  });

  it("sets position and retirement", () => {
    expect(applyPlayerPatch(player, { position: "TE", retired: true })).toEqual({
      ok: true,
      fields: { position: "TE", retired: true },
    });
  });
});
