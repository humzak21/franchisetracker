import { describe, expect, test } from "vitest";
import { HOF_WAIT, hofCase, hofEligible } from "./hofCase";

const placement = (
  statKey: string,
  rank: number,
  over: Partial<Parameters<typeof hofCase>[0]["placements"][number]> = {},
) => ({ book: "team", split: "regular", scope: "career" as const, statKey, rank, ...over });

describe("when a player can go in", () => {
  test("after five seasons away", () => {
    expect(hofEligible(2030, 2030 + HOF_WAIT)).toBe(true);
    expect(hofEligible(2030, 2030 + HOF_WAIT - 1)).toBe(false);
  });
});

describe("a player's case", () => {
  test("reads the team's regular-season book, best standing first", () => {
    const result = hofCase({
      placements: [
        placement("rushYds", 3),
        placement("rushTd", 1),
        placement("rushYds", 1, { scope: "season" }),
        placement("rushYds", 1, { book: "league" }),
        placement("rushYds", 1, { split: "postseason" }),
      ],
      awards: [],
      marks: [],
    });
    expect(result.records).toEqual([
      "#1 career rushing touchdowns",
      "#1 season rushing yards",
      "#3 career rushing yards",
    ]);
    expect(result).toMatchObject({ firsts: 2, lists: 3 });
  });

  test("keeps a stat's best game of several", () => {
    const result = hofCase({
      placements: [placement("rushYds", 4, { scope: "game" }), placement("rushYds", 2, { scope: "game" })],
      awards: [],
      marks: [],
    });
    expect(result.records).toEqual(["#2 game rushing yards"]);
  });

  test("adds up honors and keeps the weekly ones apart", () => {
    const result = hofCase({
      placements: [],
      awards: [
        { type: "ProBowl" },
        { type: "MVP" },
        { type: "ProBowl" },
        { type: "OPOW", weekKey: "w3" },
        { type: "OPOW", weekKey: "w7" },
        { type: "custom" },
      ],
      marks: [],
    });
    expect(result.honors).toEqual([
      { label: "Most Valuable Player", count: 1 },
      { label: "Pro Bowl", count: 2 },
    ]);
    expect(result.weekly).toBe(2);
  });

  test("names the highest career mark in each stat", () => {
    const result = hofCase({
      placements: [],
      awards: [],
      marks: [
        { statKey: "rushYds", mark: 5000, horizon: "career" },
        { statKey: "rushYds", mark: 10000, horizon: "career" },
        { statKey: "rushYds", mark: 12000, horizon: "season" },
        { statKey: "nope", mark: 9, horizon: "career" },
      ],
    });
    expect(result.marks).toEqual(["10,000 rushing yards"]);
  });

  test("an empty career has an empty case", () => {
    expect(hofCase({ placements: [], awards: [], marks: [] })).toEqual({
      honors: [],
      weekly: 0,
      records: [],
      firsts: 0,
      lists: 0,
      marks: [],
    });
  });
});
