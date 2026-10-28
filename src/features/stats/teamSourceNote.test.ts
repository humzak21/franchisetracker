import { describe, expect, test } from "vitest";
import type { StatTrend } from "@shared/stats/teamTrends";
import { sourceNote } from "./teamSourceNote";

const point = (year: number, source: "games" | "captured") => ({
  year,
  value: 1,
  rank: null,
  tied: false,
  source,
});

describe("sourceNote", () => {
  const trends: StatTrend[] = [
    { statKey: "pointsPg", points: [point(2026, "captured"), point(2027, "games")] },
    { statKey: "yardsPg", points: [point(2027, "games")] },
    { statKey: "sacks", points: [point(2027, "captured")] },
  ];

  test("counts the season's stats by where they came from", () => {
    expect(sourceNote(trends, 2027, 1)).toBe(
      "2 stats from 1 game · 1 from the captured season screen. Captured values replace game totals; league ranks come only from captures.",
    );
  });

  test("leaves out a source with nothing from it", () => {
    expect(sourceNote(trends, 2026, 0)).toMatch(/^1 from the captured season screen\./);
  });

  test("null for a season with no values", () => {
    expect(sourceNote(trends, 2030, 0)).toBeNull();
  });
});
