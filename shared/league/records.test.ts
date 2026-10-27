import { describe, expect, test } from "vitest";
import { recordsFromGames, shouldReplaceRecord, type ScoredGame } from "./records";

const game = (
  weekKey: ScoredGame["weekKey"],
  away: string,
  awayScore: number | undefined,
  home: string,
  homeScore: number | undefined,
): ScoredGame => ({
  weekKey,
  awayTeamId: away,
  homeTeamId: home,
  awayScore,
  homeScore,
});

describe("recordsFromGames", () => {
  test("wins, losses, ties and points for each side", () => {
    const records = recordsFromGames([
      game("w1", "SF", 23, "LAC", 20),
      game("w2", "LAC", 17, "KC", 17),
      game("w2", "SF", 10, "SEA", 31),
    ]);
    expect(records.get("SF")).toEqual({ w: 1, l: 1, t: 0, pointsFor: 33, pointsAgainst: 51 });
    expect(records.get("LAC")).toEqual({ w: 0, l: 1, t: 1, pointsFor: 37, pointsAgainst: 40 });
    expect(records.get("KC")).toEqual({ w: 0, l: 0, t: 1, pointsFor: 17, pointsAgainst: 17 });
    expect(records.get("SEA")).toEqual({ w: 1, l: 0, t: 0, pointsFor: 31, pointsAgainst: 10 });
  });

  test("unplayed, preseason and playoff games don't count", () => {
    const records = recordsFromGames([
      game("w3", "SF", undefined, "LAC", undefined),
      game("pre1", "SF", 30, "LAC", 3),
      game("wc", "SF", 30, "LAC", 3),
    ]);
    expect(records.size).toBe(0);
  });

  test("the same game from two sources counts once, the later source winning", () => {
    const records = recordsFromGames([game("w1", "LV", 17, "NE", 30), game("w1", "LV", 17, "NE", 31)]);
    expect(records.get("LV")).toEqual({ w: 0, l: 1, t: 0, pointsFor: 17, pointsAgainst: 31 });
    expect(records.get("NE")).toMatchObject({ w: 1, pointsFor: 31 });
  });
});

describe("shouldReplaceRecord", () => {
  test("fills a missing record and keeps a worked-out one current", () => {
    expect(shouldReplaceRecord(null, { w: 1, l: 0, t: 0 })).toBe(true);
    expect(shouldReplaceRecord({ w: 5, l: 0, t: 0, derived: true }, { w: 1, l: 0, t: 0 })).toBe(true);
  });

  test("replaces a captured record only when the scores cover as many games", () => {
    expect(shouldReplaceRecord({ w: 3, l: 2, t: 0, derived: false }, { w: 3, l: 2, t: 0 })).toBe(true);
    expect(shouldReplaceRecord({ w: 3, l: 2, t: 0, derived: false }, { w: 4, l: 2, t: 0 })).toBe(true);
    expect(shouldReplaceRecord({ w: 9, l: 7, t: 0, derived: false }, { w: 4, l: 2, t: 0 })).toBe(false);
  });
});
