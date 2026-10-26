import { describe, expect, test } from "vitest";
import { compareStats, leaders, radarAxes, radarValues } from "./compare";

const maye = {
  games: 34,
  totals: {
    passCmp: 700,
    passAtt: 1000,
    passYds: 7600,
    passTd: 50,
    passInt: 20,
    rushAtt: 150,
    rushYds: 900,
    rushTd: 6,
  },
};
const brady = { games: 17, totals: { passCmp: 400, passAtt: 600, passYds: 4500, passTd: 40, passInt: 8 } };
const diggs = { games: 17, totals: { rec: 100, recTargets: 140, recYds: 1300, recTd: 8 } };

describe("compare", () => {
  test("stats come from the players' position categories that someone played", () => {
    const stray = { ...brady, totals: { ...brady.totals, tackles: 11, punts: 2, puntYds: 68 } };
    const stats = compareStats(["QB", "QB"], [maye, stray]);
    expect(stats).toContain("passRating");
    expect(stats).toContain("rushYds");
    expect(stats).not.toContain("tackles");
    expect(stats).not.toContain("punts");
  });

  test("mixed positions compare on each one's categories, the lead's first", () => {
    const stats = compareStats(["QB", "WR"], [maye, diggs]);
    expect(stats.indexOf("passYds")).toBeLessThan(stats.indexOf("rushYds"));
    expect(stats.indexOf("rushYds")).toBeLessThan(stats.indexOf("recYds"));
  });

  test("radar axes are defining, higher-is-better stats; too few means no radar", () => {
    const axes = radarAxes(compareStats(["QB", "QB"], [maye, brady]));
    expect(axes).toEqual(["passCmp", "passAtt", "passYds", "passTd", "rushAtt", "rushYds"]);
    expect(radarAxes(["passYds", "passInt"])).toEqual([]);
  });

  test("radar values are shares of the group's best", () => {
    const [m, b] = radarValues(["passYds", "passTd"], [maye, brady]);
    expect(m).toEqual({ passYds: 1, passTd: 1 });
    expect(b!.passYds).toBeCloseTo(4500 / 7600);
  });

  test("leaders honor which direction is better", () => {
    const lead = leaders(["passYds", "passInt"], [maye, brady]);
    expect(lead.get("passYds")).toBe(0);
    expect(lead.get("passInt")).toBe(1);
    expect(leaders(["passYds"], [maye]).size).toBe(0);
    expect(leaders(["passTd"], [brady, brady]).size).toBe(0);
  });
});
