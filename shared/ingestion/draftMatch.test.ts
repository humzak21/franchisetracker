import { describe, expect, it } from "vitest";
import { fitsPick, matchDraftRow, type DraftPoolPlayer } from "./draftMatch";

const prospect = (over: Partial<DraftPoolPlayer> = {}): DraftPoolPlayer => ({
  playerId: "p1",
  displayName: "Rookie Corner",
  firstName: "Rookie",
  lastName: "Corner",
  aliases: [],
  position: "CB",
  college: "Georgia",
  ...over,
});
const row = (values: Record<string, string | number> = {}, name: string | null = "Rookie Corner") => ({
  name,
  values: { round: 1, pickInRound: 28, ...values },
});

describe("matchDraftRow", () => {
  it("settles on the pick already at that slot, whatever else is in the pool", () => {
    const held = prospect({ playerId: "held" });
    const match = matchDraftRow(row(), [prospect(), held], [{ overall: 28, player: held }]);
    expect(match).toMatchObject({ status: "matched", candidates: [{ playerId: "held", score: 1 }] });
  });

  it("takes a misread of the same slot as the same player", () => {
    const match = matchDraftRow(row({}, "Rookie Comer"), [], [{ overall: 28, player: prospect() }]);
    expect(match.status).toBe("matched");
  });

  it("does not take someone else's name at a slot as that player", () => {
    const match = matchDraftRow(row({}, "Sam Lee"), [], [{ overall: 28, player: prospect() }]);
    expect(match).toEqual({ status: "new", candidates: [] });
  });

  it("settles on a created player who agrees on name and college or position", () => {
    expect(matchDraftRow(row({ college: "Georgia" }), [prospect()], []).status).toBe("matched");
    expect(matchDraftRow(row({ position: "FS" }), [prospect()], []).status).toBe("matched");
  });

  it("never settles on a name alone", () => {
    expect(matchDraftRow(row(), [prospect()], []).status).toBe("ambiguous");
  });

  it("rules out a namesake from another school or position group", () => {
    expect(matchDraftRow(row({ college: "Alabama" }), [prospect()], []).status).toBe("new");
    expect(matchDraftRow(row({ position: "QB" }), [prospect()], []).status).toBe("new");
  });

  it("leaves two who fit for review", () => {
    const twin = prospect({ playerId: "p2" });
    expect(matchDraftRow(row({ college: "Georgia" }), [prospect(), twin], []).status).toBe("ambiguous");
  });

  it("has nothing to match on without a name", () => {
    expect(matchDraftRow(row({}, null), [prospect()], []).status).toBe("new");
  });
});

describe("fitsPick", () => {
  it("is the name test a recommit uses", () => {
    expect(fitsPick("R. Corner", prospect())).toBe(true);
    expect(fitsPick("Sam Lee", prospect())).toBe(false);
  });
});
