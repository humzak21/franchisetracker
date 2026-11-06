import { describe, expect, test } from "vitest";
import { editDistance, nameScore, surnameFit } from "./nameMatch";
import { matchPlayer, type NameCandidate } from "./playerMatch";

/** Players as the league files hold them: legal first names, display names as people know them. */
const stafford: NameCandidate = {
  playerId: "stafford",
  displayName: "Matthew Stafford",
  firstName: "John",
  lastName: "Stafford",
  aliases: [],
  teamAbbr: "LAR",
  position: "QB",
  inLeague: true,
};
const stewart: NameCandidate = {
  playerId: "stewart",
  displayName: "M.J. Stewart",
  firstName: "M.J.",
  lastName: "Stewart",
  aliases: [],
  teamAbbr: "HOU",
  position: "FS",
  inLeague: true,
};

describe("surnames", () => {
  test("only a screen's slips count as the same surname", () => {
    expect(editDistance("stafford", "stewart")).toBe(5);
    expect(surnameFit("diggs", "diggs")).toBe(1);
    expect(surnameFit("digs", "diggs")).toBeGreaterThan(0.9);
    expect(surnameFit("comer", "corner")).toBeGreaterThan(0.9);
    expect(surnameFit("colemanwilliam", "colemanwilliams")).toBeGreaterThan(0.9);
    expect(surnameFit("stafford", "stewart")).toBeLessThan(0.5);
    expect(surnameFit("gibbs", "dobbs")).toBeLessThan(0.5);
  });

  test("a matching initial cannot make up for a different surname", () => {
    expect(nameScore("M. Stafford", { first: "M.J.", last: "Stewart", full: "M.J. Stewart" })).toBeLessThan(
      0.6,
    );
  });
});

describe("matchPlayer with context", () => {
  test("a display name counts as much as the legal one", () => {
    const match = matchPlayer("M. Stafford", [stafford, stewart], { teamAbbr: "LAR", position: "QB" });
    expect(match.status).toBe("matched");
    expect(match.candidates.map((c) => c.playerId)).toEqual(["stafford"]);
  });

  test("a stranger with a different surname is never offered, even with no one else", () => {
    expect(matchPlayer("M. Stafford", [stewart], { teamAbbr: "LAR" })).toEqual({
      status: "new",
      candidates: [],
    });
  });

  test("the player on the team that printed the name beats a namesake out of the league", () => {
    const jaylinn = {
      ...stewart,
      playerId: "jaylinn",
      displayName: "Jaylinn Hawkins",
      firstName: "Jaylinn",
      lastName: "Hawkins",
      teamAbbr: "BAL",
      position: "SS",
    };
    const josh = {
      ...jaylinn,
      playerId: "josh",
      displayName: "Josh Hawkins",
      firstName: "Josh",
      teamAbbr: null,
      inLeague: false,
    };
    const match = matchPlayer("J.Hawkins", [josh, jaylinn], { teamAbbr: "BAL" });
    expect(match.status).toBe("matched");
    expect(match.candidates[0]?.playerId).toBe("jaylinn");
  });

  test("a game's names belong to the two teams that played, even when a line has no team", () => {
    const gibbs = {
      ...stewart,
      playerId: "gibbs",
      displayName: "Jahmyr Gibbs",
      firstName: "Jahmyr",
      lastName: "Gibbs",
      teamAbbr: "DET",
    };
    const other = {
      ...gibbs,
      playerId: "other",
      displayName: "Joe Gibbs",
      firstName: "Joe",
      teamAbbr: "WAS",
    };
    const match = matchPlayer("J.Gibbs", [other, gibbs], { teamAbbr: null, gameTeams: ["DET", "CHI"] });
    expect(match.status).toBe("matched");
    expect(match.candidates[0]?.playerId).toBe("gibbs");
  });

  test("a printing seen before settles the name, and its initial stands for that first name only", () => {
    const jaylen = {
      ...stewart,
      playerId: "jaylen",
      displayName: "Jaylen Reed",
      firstName: "Jaylen",
      lastName: "Reed",
      aliases: ["J.Reed"],
      teamAbbr: "GB",
    };
    const jarran = {
      ...jaylen,
      playerId: "jarran",
      displayName: "Jarran Reed",
      firstName: "Jarran",
      aliases: [],
      teamAbbr: "SEA",
    };
    expect(matchPlayer("Jarran Reed", [jaylen, jarran]).candidates[0]?.playerId).toBe("jarran");
    expect(matchPlayer("J.Reed", [jaylen, jarran]).candidates[0]).toMatchObject({
      playerId: "jaylen",
      score: 1,
    });
  });

  test("a badly read surname is offered from the printed roster only, and never settles", () => {
    const boutte = {
      ...stewart,
      playerId: "boutte",
      displayName: "Kayshon Boutte",
      firstName: "Kayshon",
      lastName: "Boutte",
      teamAbbr: "HOU",
    };
    const elsewhere = { ...boutte, playerId: "elsewhere", teamAbbr: "NE" };
    const match = matchPlayer("K.Bolden", [boutte, elsewhere], { teamAbbr: "HOU" });
    expect(match.status).toBe("ambiguous");
    expect(match.candidates.map((c) => c.playerId)).toEqual(["boutte"]);
  });

  test("a kicking line is not a cornerback's", () => {
    const kicker = {
      ...stewart,
      playerId: "k",
      displayName: "Sam Gardner",
      firstName: "Sam",
      lastName: "Gardner",
      teamAbbr: "IND",
      position: "K",
    };
    const corner = {
      ...kicker,
      playerId: "cb",
      displayName: "Sauce Gardner",
      firstName: "Ahmad",
      position: "CB",
    };
    const match = matchPlayer("S.Gardner", [corner, kicker], { teamAbbr: "IND", position: "K" });
    expect(match.status).toBe("matched");
    expect(match.candidates[0]?.playerId).toBe("k");
  });

  test("two teammates with one initial and surname stay a question", () => {
    const nephi = {
      ...stewart,
      playerId: "nephi",
      displayName: "Nephi Sewell",
      firstName: "Nephi",
      lastName: "Sewell",
      teamAbbr: "CHI",
      position: "MLB",
    };
    const noah = { ...nephi, playerId: "noah", displayName: "Noah Sewell" };
    expect(matchPlayer("N.Sewell", [nephi, noah], { teamAbbr: "CHI" }).status).toBe("ambiguous");
  });
});
