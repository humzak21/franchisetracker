import { describe, expect, test } from "vitest";
import { rankChange, rankTrends } from "./teamTrends";

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
    expect(rankChange(points!.points)).toBe(7);
    expect(rankChange(points!.points.slice(0, 1))).toBeNull();
  });
});
