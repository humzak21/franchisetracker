import { describe, expect, test } from "vitest";
import { rankChange, rankTrends, trendRows } from "./teamTrends";

describe("rankTrends", () => {
  test("groups rows per stat in registry order, seasons ascending, dropping unknown keys", () => {
    const trends = rankTrends([
      { year: 2027, statKey: "sacks", value: 50, rank: 3 },
      { year: 2027, statKey: "pointsPg", value: 27.3, rank: 3, tied: true },
      { year: 2026, statKey: "pointsPg", value: 21.0, rank: 12 },
      { year: 2026, statKey: "mystery", value: 1 },
    ]);
    expect(trends.map((t) => t.statKey)).toEqual(["pointsPg", "sacks"]);
    expect(trends[0]!.points).toEqual([
      { year: 2026, value: 21, rank: 12, tied: false },
      { year: 2027, value: 27.3, rank: 3, tied: true },
    ]);
  });

  test("rank change is positive when the team climbs", () => {
    const [points] = rankTrends([
      { year: 2026, statKey: "pointsPg", value: 21, rank: 12 },
      { year: 2027, statKey: "pointsPg", value: 24 },
      { year: 2028, statKey: "pointsPg", value: 27, rank: 5 },
    ]);
    expect(rankChange(points!.points, 2028)).toEqual({ climb: 7, from: 2026 });
    expect(rankChange(points!.points, 2027)).toBeNull();
    expect(rankChange(points!.points, 2026)).toBeNull();
  });

  test("rows carry the registry label and formatting", () => {
    const trends = rankTrends([
      { year: 2026, statKey: "pointsPg", value: 21, rank: 12 },
      { year: 2026, statKey: "sacks", value: 41, rank: 9 },
    ]);
    expect(trendRows(trends, ["pointsPg"])).toEqual([
      {
        key: "pointsPg",
        label: "Points per game",
        points: [{ year: 2026, value: "21.0", rank: 12, tied: false }],
      },
    ]);
  });
});
