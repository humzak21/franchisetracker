import { describe, expect, it } from "vitest";
import { statValue } from "./aggregate";
import { statsWithData } from "./categories";
import { fantasyPoints } from "./fantasy";

describe("fantasyPoints (ESPN default PPR)", () => {
  it("scores a quarterback's passing, rushing and turnovers", () => {
    // 300 yds (12) + 3 TD (12) - 1 INT (2) + 25 rush yds (2.5) + 1 rush TD (6) - 1 fumble (2)
    expect(fantasyPoints({ passYds: 300, passTd: 3, passInt: 1, rushYds: 25, rushTd: 1, fumbles: 1 })).toBe(
      28.5,
    );
  });

  it("gives a point per catch", () => {
    // 8 rec (8) + 131 yds (13.1) + 1 TD (6)
    expect(fantasyPoints({ rec: 8, recYds: 131, recTd: 1, recTargets: 11 })).toBe(27.1);
  });

  it("scores kicks by distance and takes a point per miss", () => {
    // 3 + 3 + 4 + 5 for the field goals, -1 for the miss, 3 extra points, -1 for the miss
    expect(
      fantasyPoints({ fgm: 4, fga: 5, fgm0_29: 1, fgm30_39: 1, fgm40_49: 1, fgm50plus: 1, xpm: 3, xpa: 4 }),
    ).toBe(16);
  });

  it("scores a made field goal of unknown distance as a short one", () => {
    expect(fantasyPoints({ fgm: 2, fga: 2, fgm50plus: 1 })).toBe(8);
  });

  it("scores return touchdowns but not individual defense", () => {
    expect(fantasyPoints({ tackles: 9, sacks: 2, kickReturnTd: 1 })).toBe(6);
    expect(fantasyPoints({ tackles: 9 })).toBe(0);
  });

  it("is null for a line with nothing recorded", () => {
    expect(fantasyPoints({})).toBeNull();
  });
});

describe("fantasy stats in tables", () => {
  it("adds points and points per game to any table with rows", () => {
    expect(statsWithData(["defense", "fantasy"], [{ line: { tackles: 4 }, games: 2 }])).toEqual([
      "tackles",
      "fantasyPts",
      "fantasyPpg",
    ]);
    expect(statValue("fantasyPpg", { rec: 10, recYds: 100 }, { games: 2 })).toBe(10);
  });

  it("leaves per-game points out of a single game", () => {
    expect(statsWithData(["fantasy"], [{ line: { rec: 1 } }], { singleGame: true })).toEqual(["fantasyPts"]);
  });
});
