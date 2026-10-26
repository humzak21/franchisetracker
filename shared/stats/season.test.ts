import { describe, expect, test } from "vitest";
import { categoriesWithData, statsWithData } from "./categories";
import { preferLogs, summarizeGames, summarizeSeasons } from "./season";
import { formatTeamRow, formatTeamStat, parseClock, TEAM_STAT_ROWS } from "./teamRegistry";

describe("summarizeGames", () => {
  test("totals, rates, threshold games and best games", () => {
    const summary = summarizeGames([
      { rushAtt: 20, rushYds: 120, rushTd: 2, rushLong: 40 },
      { rushAtt: 10, rushYds: 30, rushTd: 0, rushLong: 12 },
    ]);
    expect(summary.gamesPlayed).toBe(2);
    expect(summary.totals).toEqual({ rushAtt: 30, rushYds: 150, rushTd: 2, rushLong: 40 });
    expect(summary.averages.rushAvg).toBe(5);
    expect(summary.averages.rushYpg).toBe(75);
    expect(summary.averages).not.toHaveProperty("passRating");
    expect(summary.thresholdCounts).toEqual({ rush100: 1 });
    expect(summary.bests).toEqual({ rushAtt: 20, rushYds: 120, rushTd: 2 });
  });
});

describe("summarizeSeasons", () => {
  test("adds seasons, keeps the best game and rates over all games", () => {
    const a = summarizeGames([{ recYds: 120, rec: 8, recLong: 50 }]);
    const b = summarizeGames([
      { recYds: 40, rec: 3, recLong: 60 },
      { recYds: 100, rec: 6, recLong: 20 },
    ]);
    const career = summarizeSeasons([a, b]);
    expect(career.gamesPlayed).toBe(3);
    expect(career.totals).toEqual({ recYds: 260, rec: 17, recLong: 60 });
    expect(career.averages.recYpg).toBeCloseTo(86.67, 1);
    expect(career.thresholdCounts).toEqual({ rec100: 2, rec5: 2 });
    expect(career.bests.recYds).toBe(120);
  });
});

describe("preferLogs", () => {
  test("log-derived rows replace imported rows for the same season and team", () => {
    const rows = [
      { year: 2026, teamKey: "ne", source: "import" as const, id: "a" },
      { year: 2026, teamKey: "ne", source: "logs" as const, id: "b" },
      { year: 2027, teamKey: "ne", source: "import" as const, id: "c" },
    ];
    expect(preferLogs(rows).map((r) => r.id)).toEqual(["b", "c"]);
  });
});

describe("team stats", () => {
  test("clock and pair formatting", () => {
    expect(formatTeamStat("possessionSec", 1902)).toBe("31:42");
    expect(parseClock("31:42")).toBe(1902);
    const third = TEAM_STAT_ROWS.find((r) => r.id === "thirdDown")!;
    expect(formatTeamRow(third, { thirdDownConv: 5, thirdDownAtt: 12 })).toBe("5/12");
    const penalties = TEAM_STAT_ROWS.find((r) => r.id === "penalties")!;
    expect(formatTeamRow(penalties, { penalties: 6, penaltyYds: 45 })).toBe("6-45");
  });
});

describe("statsWithData", () => {
  test("keeps recorded raw stats and derived stats whose inputs exist", () => {
    const rows = [{ line: { rushAtt: 10, rushYds: 50, recYds: 0 } }];
    expect(statsWithData(["rushing"], rows)).toEqual([
      "rushAtt",
      "rushYds",
      "rushAvg",
      "rushYpg",
      "scrimmageYds",
    ]);
    expect(statsWithData(["rushing"], rows, { singleGame: true })).not.toContain("rushYpg");
    expect(statsWithData(["receiving"], rows)).toEqual(["recYds", "recYpg"]);
    expect(categoriesWithData(["passing", "rushing", "receiving"], rows)).toEqual(["rushing"]);
  });
});
