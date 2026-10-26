import { describe, expect, test } from "vitest";
import { likelyDuplicate, mergeAliases, splitDisplayName } from "./identity";

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
