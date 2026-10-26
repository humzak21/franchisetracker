import { describe, expect, test } from "vitest";
import type { WeekKey } from "../domain/calendar";
import { dayKey, monthGrid, offseasonMarkers, seasonMonths, weekDate, weekOn, weekOneSunday } from "./dates";
import { rivalries, streakLabel, weekPoints } from "./insights";

const game = (weekKey: WeekKey, us: number, them: number, extra: Record<string, unknown> = {}) => ({
  weekKey,
  status: "played" as const,
  userIsHome: true,
  homeScore: us,
  awayScore: them,
  ...extra,
});

describe("weekPoints", () => {
  test("orders by week, skips preseason, byes and unplayed games, and tracks the streak", () => {
    const points = weekPoints([
      game("w3", 10, 20),
      game("w1", 24, 17),
      game("pre2", 3, 0),
      { weekKey: "w4", status: "bye" },
      game("w2", 31, 3),
      { weekKey: "w5", status: "scheduled" },
      game("wc", 20, 20),
    ]);
    expect(points.map((p) => [p.weekKey, p.margin, p.streak])).toEqual([
      ["w1", 7, 1],
      ["w2", 28, 2],
      ["w3", -10, -1],
      ["wc", 0, 0],
    ]);
    expect(points[2]).toMatchObject({ pointsFor: 10, pointsAgainst: 20, result: "L" });
  });

  test("labels streaks", () => {
    expect([3, -2, 0].map(streakLabel)).toEqual(["W3", "L2", "T1"]);
  });
});

describe("rivalries", () => {
  test("one line per opponent across seasons, most meetings first", () => {
    const lines = rivalries([
      game("w2", 17, 20, { opponentTeamId: "BUF", year: 2026 }),
      game("w9", 27, 24, { opponentTeamId: "BUF", year: 2026 }),
      game("div", 30, 10, { opponentTeamId: "BUF", year: 2027 }),
      game("w1", 14, 21, { opponentTeamId: "KC", year: 2027 }),
      game("pre1", 14, 21, { opponentTeamId: "NYG", year: 2027 }),
      game("w3", 14, 21, { year: 2027 }),
    ]);
    expect(lines.map((r) => r.opponentTeamId)).toEqual(["BUF", "KC"]);
    expect(lines[0]).toMatchObject({
      record: { w: 2, l: 1, t: 0 },
      playoff: { w: 1, l: 0, t: 0 },
      pointsFor: 74,
      pointsAgainst: 54,
      streak: "W2",
      last: { year: 2027, weekKey: "div", us: 30, them: 10, result: "W" },
      margins: [-3, 3, 20],
    });
  });
});

describe("week dates", () => {
  test("Week 1 is the Sunday after Labor Day and the Super Bowl lands in February", () => {
    expect(dayKey(weekOneSunday(2024))).toBe("2024-09-08");
    expect(dayKey(weekDate(2024, "w18"))).toBe("2025-01-05");
    expect(dayKey(weekDate(2024, "wc"))).toBe("2025-01-12");
    expect(dayKey(weekDate(2024, "probowl"))).toBe("2025-02-02");
    expect(dayKey(weekDate(2024, "sb"))).toBe("2025-02-09");
    expect(dayKey(weekDate(2026, "w1"))).toBe("2026-09-13");
    expect(dayKey(weekDate(2026, "pre1"))).toBe("2026-08-23");
  });

  test("finds the week on a date", () => {
    expect(weekOn(2026, weekDate(2026, "w7"))).toBe("w7");
    expect(weekOn(2026, new Date(Date.UTC(2026, 9, 1)))).toBeNull();
  });

  test("offseason markers fall in March and April of the next year", () => {
    expect(offseasonMarkers(2024).map((m) => [m.key, dayKey(m.date)])).toEqual([
      ["free_agency", "2025-03-12"],
      ["draft", "2025-04-24"],
    ]);
  });

  test("month grids are Sunday first and padded to full weeks", () => {
    const sept = monthGrid(2026, 8);
    expect(sept.weeks[0]!.slice(0, 2)).toEqual([null, null]);
    expect(sept.weeks[0]![2]!.getUTCDate()).toBe(1);
    expect(sept.weeks.every((w) => w.length === 7)).toBe(true);
    expect(seasonMonths(2026).map((m) => `${m.year}-${m.month + 1}`)).toEqual([
      "2026-8",
      "2026-9",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-1",
      "2027-2",
      "2027-3",
      "2027-4",
    ]);
  });
});
