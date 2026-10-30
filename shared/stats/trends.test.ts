import { describe, expect, it } from "vitest";
import type { WeekKey } from "../domain";
import {
  chosenCurves,
  recordPace,
  rollingAverage,
  seasonCurves,
  trendStats,
  type SeasonCurve,
} from "./trends";

const game = (year: number, weekKey: WeekKey, recYds: number) => ({
  gameId: `${year}-${weekKey}`,
  seasonId: String(year),
  year,
  weekKey,
  stats: { recYds },
});

describe("trendStats", () => {
  it("lists summed stats with a number, leaving out rates and empties", () => {
    const stats = trendStats([
      { year: 2026, gamesPlayed: 10, totals: { recYds: 500, rec: 40, recLong: 60, rushYds: 0 } },
    ]);
    expect(stats).toEqual(expect.arrayContaining(["recYds", "rec", "scrimmageYds"]));
    expect(stats).not.toContain("rushYds");
    expect(stats).not.toContain("recAvg");
    expect(stats).not.toContain("recLong");
  });
});

describe("seasonCurves", () => {
  it("starts each season at game 1 and counts the regular season only", () => {
    const curves = seasonCurves(
      [game(2026, "w1", 50), game(2026, "w2", 30), game(2026, "wc", 90), game(2027, "w1", 70)],
      "recYds",
    );
    expect(curves).toEqual([
      {
        year: 2026,
        points: [
          { game: 1, total: 50 },
          { game: 2, total: 80 },
        ],
      },
      { year: 2027, points: [{ game: 1, total: 70 }] },
    ]);
  });
});

describe("chosenCurves", () => {
  const curve = (year: number, total: number): SeasonCurve => ({ year, points: [{ game: 1, total }] });

  it("takes the latest, the one before and the best", () => {
    const picks = chosenCurves([curve(2026, 900), curve(2027, 400), curve(2028, 500), curve(2029, 300)]);
    expect(picks.map((c) => [c.key, c.year])).toEqual([
      ["latest", 2029],
      ["previous", 2028],
      ["best", 2026],
    ]);
  });

  it("does not repeat a season that is already shown", () => {
    expect(chosenCurves([curve(2026, 900), curve(2027, 400)]).map((c) => c.key)).toEqual([
      "latest",
      "previous",
    ]);
    expect(chosenCurves([])).toEqual([]);
  });
});

describe("recordPace", () => {
  it("climbs in a straight line to the record", () => {
    const line = recordPace(1700, 17);
    expect(line[0]).toEqual({ game: 1, total: 100 });
    expect(line.at(-1)).toEqual({ game: 17, total: 1700 });
  });
});

describe("rollingAverage", () => {
  it("averages over the window, once there are enough games", () => {
    const games = [10, 20, 30].map((yds, i) => game(2026, `w${i + 1}` as WeekKey, yds));
    expect(rollingAverage(games, "recYds", 2).map((p) => p.value)).toEqual([15, 25]);
    expect(rollingAverage(games, "recYds", 5)).toEqual([]);
  });
});
