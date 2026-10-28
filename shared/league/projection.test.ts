import { describe, expect, test } from "vitest";
import { NFL_TEAMS } from "../domain/teams";
import { projectStandings, type ProjectionInput } from "./projection";
import { buildBracket, playoffResultsOf } from "./standings";
import { tiebreaker } from "./tiebreakers";

/** Every team at a record, with overrides. */
function league(base: [number, number], overrides: Record<string, [number, number]> = {}): ProjectionInput[] {
  return NFL_TEAMS.map((t) => {
    const [w, l] = overrides[t.abbr] ?? base;
    return { teamAbbr: t.abbr, conference: t.conference, division: t.division, w, l, t: 0 };
  });
}

const clinchOf = (rows: ProjectionInput[], abbr: string, year = 2026) =>
  projectStandings(year, rows, []).rows.get(abbr)?.clinch ?? null;

describe("clinching", () => {
  test("nobody clinches with the season wide open", () => {
    const p = projectStandings(2026, league([5, 5]), []);
    expect(p.final).toBe(false);
    expect([...p.rows.values()].every((r) => r.clinch === null)).toBe(true);
  });

  test("a team nobody in the conference can catch has the bye, which implies the rest", () => {
    expect(clinchOf(league([2, 8], { KC: [10, 0] }), "KC")).toBe("z");
  });

  test("a rival in another division who can still pass stops the bye but not the division", () => {
    expect(clinchOf(league([2, 8], { KC: [10, 0], BUF: [9, 1] }), "KC")).toBe("y");
  });

  test("a rival who could only tie still counts against the clinch", () => {
    // LV can reach 10-7 by winning out; KC can fall to 10-7.
    expect(clinchOf(league([2, 8], { KC: [10, 0], LV: [3, 7], BUF: [9, 1] }), "KC")).toBe("x");
  });

  test("two division co-leaders far ahead of the conference both clinch a spot", () => {
    const rows = league([1, 9], { BUF: [10, 0], MIA: [10, 0] });
    expect(clinchOf(rows, "BUF")).toBe("x");
    expect(clinchOf(rows, "MIA")).toBe("x");
  });
});

describe("seeding", () => {
  test("division winners take the top four seeds, then the best of the rest", () => {
    const rows = league([8, 9], {
      NE: [14, 3],
      BAL: [12, 5],
      CIN: [11, 6],
      HOU: [9, 8],
      LV: [10, 7],
      DEN: [10, 7],
    });
    const p = projectStandings(2026, rows, []);
    expect(p.final).toBe(true);
    const seed = (abbr: string) => p.rows.get(abbr)?.seed;
    expect(seed("NE")).toBe(1);
    expect(seed("BAL")).toBe(2);
    expect(seed("HOU")).toBe(4);
    expect(seed("CIN")).toBe(5);
    expect([seed("LV"), seed("DEN")].sort()).toEqual([3, 6]);
    expect(p.rows.get("NE")?.clinch).toBe("z");
    expect(p.rows.get("HOU")?.clinch).toBe("y");
    expect(p.rows.get("CIN")?.clinch).toBe("x");
    expect(p.rows.get("CLE")?.clinch).toBeNull();
  });

  test("seeds on file win over the arithmetic once the field is set", () => {
    const rows = league([8, 9]).map((r, i) =>
      r.conference === "AFC" && i % 2 === 0 ? { ...r, seed: Math.floor(i / 2) + 1 } : r,
    );
    const nfc = rows.filter((r) => r.conference === "NFC");
    nfc.slice(0, 7).forEach((r, i) => (r.seed = i + 1));
    const p = projectStandings(2026, rows, []);
    expect(p.rows.get(rows[0]!.teamAbbr)?.seed).toBe(1);
  });
});

describe("tiebreakers", () => {
  test("head-to-head settles a division tie", () => {
    const rows = league([8, 9], { MIA: [10, 7], BUF: [10, 7] });
    const games = [
      { home: "MIA", away: "BUF", homeScore: 20, awayScore: 17 },
      { home: "BUF", away: "MIA", homeScore: 10, awayScore: 24 },
    ];
    expect(tiebreaker(rows, games).division(["BUF", "MIA"])).toEqual(["MIA", "BUF"]);
  });

  test("on a wild card tie only a division's best team stays in the running", () => {
    const rows = league([8, 9], { MIA: [10, 7], BUF: [10, 7], DEN: [10, 7] });
    const games = [{ home: "MIA", away: "BUF", homeScore: 20, awayScore: 17 }];
    const rank = tiebreaker(rows, games);
    const division = new Map([
      ["MIA", 1],
      ["BUF", 2],
      ["DEN", 2],
    ]);
    const order = rank.conference(["BUF", "DEN", "MIA"], (t) => division.get(t) ?? 9);
    expect(order.indexOf("MIA")).toBeLessThan(order.indexOf("BUF"));
  });
});

describe("bracket from scores", () => {
  test("a scored game decides its round while the runs are still going", () => {
    const rows = league([8, 9]).map((r) => ({ ...r, teamAbbr: r.teamAbbr }));
    const seeds = ["KC", "BUF", "BAL", "HOU", "LAC", "PIT", "DEN"];
    const field = rows.map((r) => {
      const seed = seeds.indexOf(r.teamAbbr);
      return seed >= 0 ? { ...r, seed: seed + 1 } : r;
    });
    const bracket = buildBracket(field, [
      { round: "wc", home: "BUF", away: "DEN", homeScore: 13, awayScore: 20 },
    ]);
    const wc = bracket.filter((g) => g.round === "wc");
    expect(wc.find((g) => g.home.teamAbbr === "BUF")?.winner).toBe("DEN");
    expect(wc.find((g) => g.home.teamAbbr === "BAL")?.winner).toBeNull();
    expect(playoffResultsOf(bracket).get("BUF")).toBe("wc_loss");
  });
});
