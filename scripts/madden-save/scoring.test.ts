import { describe, expect, it } from "vitest";
import { scoringPlays, type SummaryRow } from "./scoring";

const row = (
  quarter: number,
  timeLeft: number,
  [homePrevious, homeCurrent]: [number, number],
  [awayPrevious, awayCurrent]: [number, number],
  conversion = "None",
): SummaryRow => ({ quarter, timeLeft, homePrevious, homeCurrent, awayPrevious, awayCurrent, conversion });

/** A real save's MIA at NE, 31-54: each row stops at the six, the try is in the next row's "previous". */
const MIA_AT_NE: SummaryRow[] = [
  row(1, 324, [0, 0], [0, 6], "FieldGoal"),
  row(1, 57, [0, 6], [7, 7], "FieldGoal"),
  row(2, 536, [7, 7], [7, 13], "FieldGoal"),
  row(2, 526, [7, 13], [14, 14], "FieldGoal"),
  row(2, 323, [14, 14], [14, 20], "FieldGoal"),
  row(2, 134, [14, 20], [21, 21], "FieldGoal"),
  row(2, 9, [21, 27], [21, 21], "FieldGoal"),
  row(3, 643, [28, 34], [21, 21]),
  row(3, 324, [34, 34], [21, 24]),
  row(3, 82, [34, 40], [24, 24], "FieldGoal"),
  row(4, 581, [41, 41], [24, 30], "FieldGoal"),
  row(4, 220, [41, 47], [31, 31]),
  row(4, 137, [47, 53], [31, 31], "FieldGoal"),
];

const plays = (rows: SummaryRow[], home: number, away: number) =>
  scoringPlays(rows, { home, away }, { home: "NE", away: "MIA" });

describe("scoringPlays", () => {
  it("adds each touchdown's try from the next row, and the last one's from the final", () => {
    const out = plays(MIA_AT_NE, 54, 31);
    expect(out.map((p) => [p.teamAbbr, p.kind, p.pat, p.awayScore, p.homeScore])).toEqual([
      ["MIA", "other", "kick", 7, 0],
      ["NE", "other", "kick", 7, 7],
      ["MIA", "other", "kick", 14, 7],
      ["NE", "other", "kick", 14, 14],
      ["MIA", "other", "kick", 21, 14],
      ["NE", "other", "kick", 21, 21],
      ["NE", "other", "kick", 21, 28],
      ["NE", "other", null, 21, 34],
      ["MIA", "fg", null, 24, 34],
      ["NE", "other", "kick", 24, 41],
      ["MIA", "other", "kick", 31, 41],
      ["NE", "other", null, 31, 47],
      ["NE", "other", "kick", 31, 54],
    ]);
  });

  it("moves the score by exactly what each play and its try are worth, ending on the final", () => {
    const out = plays(MIA_AT_NE, 54, 31);
    let [home, away] = [0, 0];
    for (const play of out) {
      expect(play.homeScore === home || play.awayScore === away).toBe(true);
      [home, away] = [play.homeScore, play.awayScore];
    }
    expect([home, away]).toEqual([54, 31]);
    expect(out.map((p) => p.order)).toEqual(out.map((_, i) => i + 1));
  });

  it("reads two-point tries, failed kicks, field goals and safeties", () => {
    const out = plays(
      [
        row(1, 600, [0, 6], [0, 0], "Touchdown"),
        row(2, 300, [8, 14], [0, 0], "FieldGoal"),
        row(3, 200, [14, 14], [0, 2]),
        row(4, 100, [14, 17], [2, 2]),
      ],
      17,
      2,
    );
    expect(out.map((p) => [p.kind, p.pat, p.description])).toEqual([
      ["other", "two", "Touchdown, two-point try good (play not in the save)"],
      ["other", "kick_failed", "Touchdown, kick missed (play not in the save)"],
      ["safety", null, "Safety"],
      ["fg", null, "Field goal"],
    ]);
  });

  it("puts rows in game order whatever order the save keeps them in", () => {
    const out = plays([...MIA_AT_NE].reverse(), 54, 31);
    expect(out[0]).toMatchObject({ period: 1, clock: 324, awayScore: 7, homeScore: 0 });
    expect(out.at(-1)).toMatchObject({ period: 4, clock: 137, homeScore: 54 });
  });
});
