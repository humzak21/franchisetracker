import { describe, expect, test } from "vitest";
import { agedContract, carriedEntry, stillSeen } from "./carryOver";

const next = { year: 2027, userTeam: true };

describe("carriedEntry", () => {
  test("ages the player a year and keeps everything else", () => {
    expect(carriedEntry({ status: "active", age: 24, exp: 2, ovr: 81, jersey: 10 }, next)).toEqual({
      status: "active",
      age: 25,
      exp: 3,
      ovr: 81,
      jersey: 10,
    });
  });

  test("leaves unknown age and experience unknown", () => {
    expect(carriedEntry({ status: "practice_squad" }, next)).toEqual({ status: "practice_squad" });
  });

  test("injured reserve ends with the season", () => {
    expect(carriedEntry({ status: "ir", statusWeekKey: "w9" }, next)).toEqual({ status: "active" });
  });

  test("players who left the team stay behind", () => {
    expect(carriedEntry({ status: "released" }, next)).toBeNull();
    expect(carriedEntry({ status: "traded" }, next)).toBeNull();
  });

  test("a user-team deal that runs out waits on the owner, with its terms kept", () => {
    expect(
      carriedEntry({ status: "active", contract: { years: 1, apy: 5_000_000, expiresYear: 2026 } }, next),
    ).toEqual({ status: "unsigned", contract: { years: 0, apy: 5_000_000, expiresYear: 2026 } });
  });

  test("a deal with years left stays, a year shorter", () => {
    expect(
      carriedEntry({ status: "ir", contract: { years: 3, apy: 5_000_000, expiresYear: 2028 } }, next),
    ).toEqual({ status: "active", contract: { years: 2, apy: 5_000_000, expiresYear: 2028 } });
  });

  test("another team's expired deal is dropped, and the player stays as they were", () => {
    expect(
      carriedEntry(
        { status: "active", contract: { years: 1, expiresYear: 2026 } },
        { year: 2027, userTeam: false },
      ),
    ).toEqual({ status: "active" });
  });

  test("a player left unsigned stays unsigned", () => {
    expect(carriedEntry({ status: "unsigned", contract: { years: 0, expiresYear: 2025 } }, next)).toEqual({
      status: "unsigned",
      contract: { years: 0, expiresYear: 2025 },
    });
  });
});

describe("agedContract", () => {
  test("pins the yearly figure before the years shrink", () => {
    expect(agedContract({ years: 4, total: 40_000_000 }, 2027)).toEqual({
      contract: { years: 3, total: 40_000_000, apy: 10_000_000 },
      expired: false,
    });
  });

  test("the last year runs out", () => {
    expect(agedContract({ years: 1 }, 2027).expired).toBe(true);
  });

  test("the expiry year decides over the years left", () => {
    expect(agedContract({ years: 1, expiresYear: 2027 }, 2027).expired).toBe(false);
  });

  test("a deal with no length stays as it is", () => {
    expect(agedContract({ apy: 1_000_000 }, 2027)).toEqual({
      contract: { apy: 1_000_000 },
      expired: false,
    });
  });
});

describe("stillSeen", () => {
  test("keeps players named in the last two seasons", () => {
    expect(stillSeen(2026, 2026)).toBe(true);
    expect(stillSeen(2025, 2026)).toBe(true);
    expect(stillSeen(2024, 2026)).toBe(false);
  });

  test("a player nothing has dated yet stays", () => {
    expect(stillSeen(undefined, 2026)).toBe(true);
  });
});
