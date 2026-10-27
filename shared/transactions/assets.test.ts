import { describe, expect, test } from "vitest";
import { contractError, normalizeContract, orientToUser, pickError, pickLabel, planPicks } from "./assets";

describe("trade assets", () => {
  test("pick labels name the year and round, and the original team when it differs", () => {
    expect(pickLabel({ year: 2027, round: 2 })).toBe("2027 R2");
    expect(pickLabel({ year: 2027, round: 1 }, "KC")).toBe("2027 R1 (KC)");
  });

  test("picks in come from the partner and picks out go to it", () => {
    expect(
      planPicks("NE", "KC", [{ year: 2027, round: 1 }], [{ year: 2028, round: 3, originTeamId: "LV" }]),
    ).toEqual([
      { year: 2027, round: 1, fromTeamId: "KC", toTeamId: "NE" },
      { year: 2028, round: 3, originTeamId: "LV", fromTeamId: "NE", toTeamId: "KC" },
    ]);
  });

  test("a trade entered from the partner's side flips to the user team's", () => {
    const trade = {
      teamId: "KC",
      counterpartTeamId: "NE",
      playersIn: ["maye"],
      playersOut: ["kelce"],
      picksIn: [],
      picksOut: [{ year: 2027, round: 1 }],
      notes: "kept",
    };
    expect(orientToUser(trade, "NE")).toEqual({
      teamId: "NE",
      counterpartTeamId: "KC",
      playersIn: ["kelce"],
      playersOut: ["maye"],
      picksIn: [{ year: 2027, round: 1 }],
      picksOut: [],
      notes: "kept",
    });
    expect(orientToUser(trade, "BUF")).toBe(trade);
  });

  test("contracts fill the yearly average and the last season it covers", () => {
    expect(normalizeContract({ years: 3, total: 60_000_000 }, 2026)).toEqual({
      years: 3,
      total: 60_000_000,
      apy: 20_000_000,
      expiresYear: 2028,
    });
    expect(normalizeContract({ apy: 1_000_000, total: undefined }, 2026)).toEqual({ apy: 1_000_000 });
    expect(normalizeContract({}, 2026)).toBeUndefined();
    expect(normalizeContract(undefined, 2026)).toBeUndefined();
  });

  test("bad picks and contracts are refused", () => {
    expect(pickError({ year: 2027, round: 7 })).toBeNull();
    expect(pickError({ year: 2027, round: 8 })).toMatch(/Rounds/);
    expect(pickError({ year: 1900, round: 1 })).toMatch(/year/);
    expect(contractError({ years: 2, total: 1 })).toBeNull();
    expect(contractError({ total: -1 })).toMatch(/negative/);
    expect(contractError({ years: 0 })).toMatch(/years/);
  });
});
