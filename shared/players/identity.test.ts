import { describe, expect, test } from "vitest";
import {
  aliasFields,
  likelyDuplicate,
  mergeAliases,
  newPlayerName,
  repairedName,
  splitDisplayName,
  upgradedName,
} from "./identity";

describe("player identity", () => {
  test("flags near-identical names at compatible positions only", () => {
    const maye = { displayName: "Drake Maye", aliases: [], position: "QB" as const };
    expect(likelyDuplicate({ displayName: "Drake Maey", aliases: [], position: "QB" }, maye)).toBe(true);
    expect(likelyDuplicate({ displayName: "D. Maye", aliases: [], position: "QB" }, maye)).toBe(true);
    expect(likelyDuplicate({ displayName: "Drake London", aliases: [], position: "WR" }, maye)).toBe(false);
    // Same name, different side of the ball: two people.
    expect(likelyDuplicate({ displayName: "Drake Maye", aliases: [], position: "CB" }, maye)).toBe(false);
    expect(
      likelyDuplicate(
        { displayName: "Josh Allen", aliases: [], position: "QB" },
        { displayName: "Josh Allen", aliases: [], position: "LEDG" },
      ),
    ).toBe(false);
  });

  test("splits names, keeping particles and suffixes with the last name", () => {
    expect(splitDisplayName("  Amon-Ra  St. Brown ")).toEqual({
      firstName: "Amon-Ra",
      lastName: "St. Brown",
      displayName: "Amon-Ra St. Brown",
    });
    expect(splitDisplayName("Odell Beckham Jr.")).toMatchObject({
      firstName: "Odell",
      lastName: "Beckham Jr.",
    });
    expect(splitDisplayName("Pelé")).toMatchObject({ firstName: "", lastName: "Pelé" });
  });

  test("merges aliases without the display name or case duplicates", () => {
    expect(mergeAliases("Drake Maye", ["D. Maye"], ["d. maye", " Drake Maye ", "", "Maye"])).toEqual([
      "D. Maye",
      "Maye",
    ]);
  });
});

describe("names as screens print them", () => {
  test("gives a joined initial its space, so a list's name splits", () => {
    expect(splitDisplayName("M.Hawkins")).toEqual({
      firstName: "M.",
      lastName: "Hawkins",
      displayName: "M. Hawkins",
    });
    expect(splitDisplayName("D.J.Moore").displayName).toBe("D.J. Moore");
    expect(splitDisplayName("T.J. Watt").displayName).toBe("T.J. Watt");
  });

  test("keeps a printing that was tidied as an alias, and only then", () => {
    expect(newPlayerName("M.Hawkins")).toMatchObject({
      displayName: "M. Hawkins",
      aliases: ["M.Hawkins"],
      aliasesText: "M.Hawkins",
    });
    expect(newPlayerName("Marcellous Hawkins")).toMatchObject({ aliases: [], aliasesText: undefined });
  });

  test("writes the search text with the aliases", () => {
    expect(aliasFields(["M.Hawkins", "M. H"]).aliasesText).toBe("M.Hawkins M. H");
    expect(aliasFields([])).toEqual({ aliases: [], aliasesText: undefined });
  });

  test("upgrades a one-initial name from a fuller printing of the same person", () => {
    expect(upgradedName("M. Hawkins", "Marcellous Hawkins")).toBe("Marcellous Hawkins");
    expect(upgradedName("M.Hawkins", "Marcellous Hawkins")).toBe("Marcellous Hawkins");
    expect(upgradedName("A. St. Brown", "Amon-Ra St. Brown")).toBe("Amon-Ra St. Brown");
    expect(upgradedName("M. Hawkins", "Terrell Hawkins")).toBeNull();
    expect(upgradedName("M. Hawkins", "Marcellous Hawkin")).toBeNull();
    expect(upgradedName("Marcellous Hawkins", "Marcel Hawkins")).toBeNull();
    expect(upgradedName("D.J. Moore", "Denniston Moore")).toBeNull();
    expect(upgradedName("M. Hawkins", "M.Hawkins")).toBeNull();
  });

  test("repairs the old naive split and leaves a hand-edited name alone", () => {
    const stored = { firstName: "", lastName: "M.Hawkins", displayName: "M.Hawkins", aliases: [] };
    expect(repairedName(stored)).toMatchObject({
      firstName: "M.",
      lastName: "Hawkins",
      displayName: "M. Hawkins",
      aliases: ["M.Hawkins"],
    });
    expect(
      repairedName({
        firstName: "Amon-Ra St.",
        lastName: "Brown",
        displayName: "Amon-Ra St. Brown",
        aliases: [],
      }),
    ).toMatchObject({ firstName: "Amon-Ra", lastName: "St. Brown", aliases: [] });
    expect(
      repairedName({
        firstName: "Amon Ra",
        lastName: "St. Brown",
        displayName: "Amon-Ra St. Brown",
        aliases: [],
      }),
    ).toBeNull();
    expect(
      repairedName({ firstName: "Drake", lastName: "Maye", displayName: "Drake Maye", aliases: [] }),
    ).toBeNull();
  });
});
