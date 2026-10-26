import { describe, expect, test } from "vitest";
import { headlineFacts } from "./headline";

const base = {
  status: "regular" as const,
  regular: { w: 4, l: 1, t: 0 },
  pointsFor: 140,
  pointsAgainst: 108,
  streak: "W2",
  divisionRank: 1,
  seed: null,
  division: "AFC East",
};

describe("headlineFacts", () => {
  test("a season in progress", () => {
    expect(headlineFacts(base).map((f) => [f.label, f.value, f.detail])).toEqual([
      ["Record", "4-1", "Regular season"],
      ["Division", "1st", "AFC East"],
      ["Streak", "W2", "Current"],
      ["Point diff", "+32", "140-108"],
      ["Playoffs", "Alive", "In the hunt"],
    ]);
  });

  test("an imported season reads the stored record and result", () => {
    const facts = headlineFacts({
      ...base,
      status: "complete",
      regular: { w: 0, l: 0, t: 0 },
      stored: { w: 14, l: 3, t: 0, playoffResult: "champion" },
      pointsFor: 0,
      pointsAgainst: 0,
      streak: null,
      seed: 1,
    });
    expect(facts.map((f) => f.value)).toEqual(["14-3", "1st", "—", "—", "Champs"]);
    expect(facts.at(-1)?.detail).toBe("Won Super Bowl");
  });

  test("a season not started yet", () => {
    expect(headlineFacts({ ...base, status: "upcoming" }).at(-1)).toMatchObject({
      value: "—",
      detail: "Season not started",
    });
  });

  test("a seed before the playoffs are decided", () => {
    expect(headlineFacts({ ...base, status: "postseason", seed: 3 }).at(-1)).toEqual({
      label: "Playoffs",
      value: "#3",
      detail: "Playoff seed",
    });
  });
});
