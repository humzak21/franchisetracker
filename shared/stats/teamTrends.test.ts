import { describe, expect, test } from "vitest";
import { rankChange, rankTrends, seasonRows, trendRows } from "./teamTrends";

describe("rankTrends", () => {
  test("groups rows per stat in registry order, seasons ascending, dropping unknown keys", () => {
    const trends = rankTrends([
      { year: 2027, statKey: "sacks", value: 50, rank: 3, source: "captured" },
      { year: 2027, statKey: "pointsPg", value: 27.3, rank: 3, tied: true, source: "captured" },
      { year: 2026, statKey: "pointsPg", value: 21.0, rank: 12, source: "captured" },
      { year: 2026, statKey: "mystery", value: 1, source: "captured" },
    ]);
    expect(trends.map((t) => t.statKey)).toEqual(["pointsPg", "sacks"]);
    expect(trends[0]!.points).toEqual([
      { year: 2026, value: 21, rank: 12, tied: false, source: "captured" },
      { year: 2027, value: 27.3, rank: 3, tied: true, source: "captured" },
    ]);
  });

  test("rank change is positive when the team climbs", () => {
    const [points] = rankTrends([
      { year: 2026, statKey: "pointsPg", value: 21, rank: 12, source: "captured" },
      { year: 2027, statKey: "pointsPg", value: 24, source: "captured" },
      { year: 2028, statKey: "pointsPg", value: 27, rank: 5, source: "captured" },
    ]);
    expect(rankChange(points!.points, 2028)).toEqual({ climb: 7, from: 2026 });
    expect(rankChange(points!.points, 2027)).toBeNull();
    expect(rankChange(points!.points, 2026)).toBeNull();
  });

  test("rows carry the registry label and formatting", () => {
    const trends = rankTrends([
      { year: 2026, statKey: "pointsPg", value: 21, rank: 12, source: "captured" },
      { year: 2026, statKey: "sacks", value: 41, rank: 9, source: "captured" },
    ]);
    expect(trendRows(trends, ["pointsPg"])).toEqual([
      {
        key: "pointsPg",
        label: "Points per game",
        points: [{ year: 2026, value: "21.0", rank: 12, tied: false, source: "captured" }],
      },
    ]);
  });
});

describe("seasonRows", () => {
  const derived = [{ year: 2027, stats: { pointsPg: 24.5, sacks: 30 } }];

  test("derived values fill in where nothing was captured", () => {
    expect(seasonRows([], derived)).toEqual([
      { year: 2027, statKey: "pointsPg", value: 24.5, source: "games" },
      { year: 2027, statKey: "sacks", value: 30, source: "games" },
    ]);
  });

  test("a captured value overrides the derived one and brings its rank", () => {
    const rows = seasonRows([{ year: 2027, statKey: "pointsPg", value: 27.3, rank: 3, tied: true }], derived);
    expect(rows).toEqual([
      { year: 2027, statKey: "pointsPg", value: 27.3, rank: 3, tied: true, source: "captured" },
      { year: 2027, statKey: "sacks", value: 30, source: "games" },
    ]);
  });

  test("captured seasons with nothing derived still show", () => {
    expect(seasonRows([{ year: 2026, statKey: "sacks", value: 41, rank: 4 }], derived)).toContainEqual({
      year: 2026,
      statKey: "sacks",
      value: 41,
      rank: 4,
      tied: undefined,
      source: "captured",
    });
  });
});
