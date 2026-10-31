import { describe, expect, test } from "vitest";
import { capSummary, runsOut } from "./cap";
import { agedContract } from "./carryOver";

describe("whether a contract runs out", () => {
  test("an end year decides over years left", () => {
    expect(runsOut({ expiresYear: 2027, years: 3 }, 2027)).toBe(true);
    expect(runsOut({ expiresYear: 2028, years: 1 }, 2027)).toBe(false);
  });

  test("with no end year, the last year left is the one that runs out", () => {
    expect(runsOut({ years: 1 }, 2027)).toBe(true);
    expect(runsOut({ years: 2 }, 2027)).toBe(false);
  });

  test("an undated contract runs on, and so does none at all", () => {
    expect(runsOut({ apy: 1_000_000 }, 2027)).toBe(false);
    expect(runsOut(undefined, 2027)).toBe(false);
  });

  test("carry-over agrees with the cap view about the same contract", () => {
    for (const contract of [{ years: 1 }, { years: 2 }, { expiresYear: 2027 }, { expiresYear: 2028 }]) {
      expect(agedContract(contract, 2028).expired).toBe(runsOut(contract, 2027));
    }
  });
});

describe("the cap for a season", () => {
  const rows = [
    { playerId: "a", contract: { apy: 10_000_000, expiresYear: 2027 } },
    { playerId: "b", contract: { apy: 4_000_000, years: 1 } },
    { playerId: "c", contract: { apy: 2_000_000, years: 3 } },
    { playerId: "d" },
  ];

  test("adds up what is committed and what comes off next year", () => {
    const summary = capSummary(rows, 20_000_000, 2027);
    expect(summary.committed).toBe(16_000_000);
    expect(summary.space).toBe(4_000_000);
    expect(summary.expiring).toEqual(["a", "b"]);
    expect(summary.freed).toBe(14_000_000);
    expect(summary.unknown).toEqual(["d"]);
  });

  test("an expiring deal with no cap hit frees nothing, but still expires", () => {
    const summary = capSummary([{ playerId: "a", contract: { years: 1 } }], undefined, 2027);
    expect(summary).toMatchObject({ expiring: ["a"], freed: 0, space: null });
  });
});
