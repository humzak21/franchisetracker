import { describe, expect, it } from "vitest";
import { withMissingGames } from "./reconcile";

const logged = { gamesPlayed: 15, totals: { recYds: 1100, rec: 80, recTd: 7 } };

describe("withMissingGames", () => {
  it("leaves the logs alone without a reported row", () => {
    expect(withMissingGames(logged, undefined)).toEqual({ ...logged, overridden: [] });
  });

  it("uses the screen's number only where a missing game was flagged", () => {
    const reported = {
      gamesPlayed: 16,
      stats: { recYds: 1180, rec: 86, recTd: 8 },
      resolved: { recYds: "missing", rec: "logs", gamesPlayed: "missing" } as const,
    };
    expect(withMissingGames(logged, reported)).toEqual({
      gamesPlayed: 16,
      totals: { recYds: 1180, rec: 80, recTd: 7 },
      overridden: ["recYds", "gamesPlayed"],
    });
  });

  it("adds a stat the logs never recorded", () => {
    const reported = { stats: { fum: 1 }, resolved: { fum: "missing" } as const };
    expect(withMissingGames(logged, reported).totals.fum).toBe(1);
  });

  it("ignores a resolution for a value the screen didn't print", () => {
    const reported = { stats: {}, resolved: { recYds: "missing", gamesPlayed: "missing" } as const };
    expect(withMissingGames(logged, reported)).toEqual({ ...logged, overridden: [] });
  });

  it("doesn't change the logged totals it was given", () => {
    withMissingGames(logged, { stats: { recYds: 1 }, resolved: { recYds: "missing" } });
    expect(logged.totals.recYds).toBe(1100);
  });
});
