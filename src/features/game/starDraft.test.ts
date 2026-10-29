import { describe, expect, it } from "vitest";
import { draftFromStars, matching, starsInput } from "./starDraft";

const stars = [
  {
    playerId: "p1",
    name: "Drake Maye",
    position: "QB",
    headshotUrl: null,
    caption: "3 TD",
    statLine: null,
    teamId: "t1",
  },
  {
    playerId: null,
    name: "Opponent standout",
    position: null,
    headshotUrl: null,
    caption: null,
    statLine: null,
    teamId: null,
  },
];

describe("starDraft", () => {
  it("round-trips shown stars to setStars arguments", () => {
    const draft = draftFromStars(stars);
    expect(draft.map((s) => s.key)).toEqual(["p1", "typed-1-Opponent standout"]);
    expect(starsInput(draft)).toEqual([
      { playerId: "p1", teamId: "t1", caption: "3 TD" },
      { rawName: "Opponent standout" },
    ]);
  });

  it("drops blank captions", () => {
    const [first] = draftFromStars(stars);
    expect(starsInput([{ ...first!, caption: "   " }])).toEqual([{ playerId: "p1", teamId: "t1" }]);
  });

  it("matches candidates by name, leaving out those already picked", () => {
    const candidates = [
      { playerId: "p1", name: "Drake Maye" },
      { playerId: "p2", name: "Stefon Diggs" },
      { playerId: "p3", name: "Drake London" },
    ];
    expect(matching(candidates, draftFromStars(stars), "drake").map((c) => c.playerId)).toEqual(["p3"]);
    expect(matching(candidates, [], "").length).toBe(3);
  });
});
