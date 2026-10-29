import { describe, expect, test } from "vitest";
import { finishTiers, playoffFinishLabel, seasonRecordError, superBowlName } from "./seasonRecord";

describe("superBowlName", () => {
  test("numbers each game by the season it ends", () => {
    expect(superBowlName(1966)).toBe("Super Bowl I");
    expect(superBowlName(2001)).toBe("Super Bowl XXXVI");
    expect(superBowlName(2016)).toBe("Super Bowl LI");
    expect(superBowlName(2024)).toBe("Super Bowl LIX");
    expect(superBowlName(1984)).toBe("Super Bowl XIX");
  });

  test("Super Bowl 50 has no numeral, and there was none before 1966", () => {
    expect(superBowlName(2015)).toBe("Super Bowl 50");
    expect(superBowlName(1965)).toBeNull();
  });
});

describe("seasonRecordError", () => {
  test("a full season with its finish saves", () => {
    expect(
      seasonRecordError({ w: 14, l: 2, t: 0, divisionRank: 1, seed: 1, playoffResult: "champion" }),
    ).toBeNull();
    expect(seasonRecordError({ w: 9, l: 4, t: 1, divisionRank: 7 })).toBeNull();
  });

  test("records outside a season are refused", () => {
    expect(seasonRecordError({ w: 0, l: 0, t: 0 })).toMatch(/record/);
    expect(seasonRecordError({ w: 15, l: 3, t: 0 })).toMatch(/18 games/);
    expect(seasonRecordError({ w: -1, l: 3, t: 0 })).toMatch(/whole numbers/);
    expect(seasonRecordError({ w: 10, l: 6, t: 0, divisionRank: 9 })).toMatch(/Division/);
    expect(seasonRecordError({ w: 10, l: 6, t: 0, seed: 8 })).toMatch(/Seeds/);
  });
});

describe("finish", () => {
  test("division titles and top seeds stand out, Super Bowl wins most", () => {
    expect(finishTiers({ divisionRank: 1, seed: 1, playoffResult: "champion" })).toEqual({
      division: 1,
      seed: 1,
      playoffs: 2,
    });
    expect(finishTiers({ divisionRank: 2, seed: 5, playoffResult: "sb_loss" })).toEqual({
      division: 0,
      seed: 0,
      playoffs: 0,
    });
  });

  test("a champion's result names its Super Bowl", () => {
    expect(playoffFinishLabel("champion", 2016)).toBe("Won Super Bowl LI");
    expect(playoffFinishLabel("champion", 1960)).toBe("Won NFL title");
    expect(playoffFinishLabel("div_loss", 2016)).toBe("Lost Divisional");
  });
});
