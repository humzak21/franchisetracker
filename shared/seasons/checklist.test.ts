import { describe, expect, test } from "vitest";
import { RAW_STAT_CATEGORIES } from "../stats/registry";
import { currentGroup, isGroupDone, seasonChecklist, type ChecklistFacts } from "./checklist";
import { coverageItems } from "./coverage";

const answered = { status: "answered" as const };

const facts: ChecklistFacts = {
  status: "upcoming",
  firstSeason: false,
  carried: true,
  retirementsWaiting: 0,
  unsigned: 0,
  signings: 0,
  draftPicks: 7,
  rosterPage: true,
  depthChart: true,
  goals: 2,
  prompts: { preseason: answered, postseason: { status: "pending" } },
  week: "w1",
  weekHasBoxScore: false,
  weekHasAwards: false,
  regularGames: 0,
  standingsGames: 0,
  seasonStats: [],
  teamStats: false,
  yearlyAwards: 0,
  playoffsSettled: false,
};

const group = (f: ChecklistFacts, key: string) => seasonChecklist(f).find((g) => g.key === key)!;
const item = (f: ChecklistFacts, groupKey: string, key: string) =>
  group(f, groupKey).items.find((i) => i.key === key);

describe("seasonChecklist", () => {
  test("the first season has nothing to carry, retire or re-sign", () => {
    const keys = group({ ...facts, firstSeason: true }, "offseason").items.map((i) => i.key);
    expect(keys).toEqual(["free_agency", "draft", "roster_page"]);
  });

  test("items read the data", () => {
    expect(item({ ...facts, unsigned: 3 }, "offseason", "resign")).toMatchObject({
      done: false,
      detail: "3 contracts ran out",
    });
    expect(item(facts, "offseason", "resign")?.done).toBe(true);
    expect(item({ ...facts, retirementsWaiting: 1 }, "offseason", "retirements")).toMatchObject({
      done: false,
      detail: "1 player to look at",
    });
    expect(item({ ...facts, draftPicks: 0 }, "offseason", "draft")?.done).toBe(false);
    expect(item({ ...facts, prompts: null }, "preseason", "preseason_report")?.done).toBe(false);
  });

  test("free agency never holds the offseason open", () => {
    expect(isGroupDone(group(facts, "offseason"))).toBe(true);
    expect(isGroupDone(group({ ...facts, rosterPage: false }, "offseason"))).toBe(false);
  });

  test("standings count as current once they reach the games played", () => {
    const week = { ...facts, regularGames: 9, standingsGames: 8 };
    expect(item(week, "week", "standings")).toMatchObject({ done: false, detail: "Through 8 of 9 games" });
    expect(item({ ...week, standingsGames: 9 }, "week", "standings")?.done).toBe(true);
  });

  test("season stats name what is left", () => {
    const stats = item({ ...facts, seasonStats: ["passing"] }, "end", "season_stats");
    expect(stats?.done).toBe(false);
    expect(stats?.detail).toContain("Rushing");
    expect(stats?.detail).not.toContain("Passing");
    expect(item({ ...facts, seasonStats: RAW_STAT_CATEGORIES }, "end", "season_stats")?.done).toBe(true);
  });

  test("final standings need a whole season's games", () => {
    expect(item({ ...facts, standingsGames: 16 }, "end", "final_standings")?.done).toBe(false);
    expect(item({ ...facts, standingsGames: 17 }, "end", "final_standings")?.done).toBe(true);
  });
});

describe("currentGroup", () => {
  test("follows the season", () => {
    const groups = seasonChecklist(facts);
    expect(currentGroup("regular", groups)).toBe("week");
    expect(currentGroup("postseason", groups)).toBe("end");
    expect(currentGroup("complete", groups)).toBe("end");
  });

  test("the offseason gives way to the preseason once it is done", () => {
    expect(currentGroup("upcoming", seasonChecklist(facts))).toBe("preseason");
    expect(currentGroup("upcoming", seasonChecklist({ ...facts, draftPicks: 0 }))).toBe("offseason");
  });
});

test("coverageItems caps standings and awards at the games played", () => {
  const items = coverageItems({
    played: 10,
    boxScores: 9,
    teamStats: 8,
    scoringSummaries: 7,
    regularGames: 9,
    standingsGames: 12,
    awardWeeks: 4,
  });
  expect(items.map((i) => [i.key, i.have, i.of])).toEqual([
    ["box", 9, 10],
    ["team", 8, 10],
    ["scoring", 7, 10],
    ["standings", 9, 9],
    ["awards", 4, 9],
  ]);
});
