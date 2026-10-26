import { describe, expect, test } from "vitest";
import type { WeekKey } from "../domain/calendar";
import { dayKey, monthGrid, offseasonMarkers, seasonMonths, weekDate, weekOneSunday } from "./dates";
import { marginBars, meetingBars, pointsWeeks, streakBars } from "./charts";
import { rivalries, streakLabel, weekPoints } from "./insights";
import { calendarEntries } from "./seasonCalendar";

const game = (weekKey: WeekKey, us: number, them: number) => ({
  weekKey,
  status: "played" as const,
  userIsHome: true,
  homeScore: us,
  awayScore: them,
});
const meeting = (weekKey: WeekKey, us: number, them: number, year: number, opponentTeamId?: string) => ({
  ...game(weekKey, us, them),
  year,
  opponentTeamId,
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
      meeting("w2", 17, 20, 2026, "BUF"),
      meeting("w9", 27, 24, 2026, "BUF"),
      meeting("div", 30, 10, 2027, "BUF"),
      meeting("w1", 14, 21, 2027, "KC"),
      meeting("pre1", 14, 21, 2027, "NYG"),
      meeting("w3", 14, 21, 2027),
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

describe("chart points", () => {
  test("label weeks with the opponent and format the values", () => {
    const points = weekPoints([game("w1", 24, 17), game("w2", 10, 13)]);
    const withOpponent = points.map((p) => ({ ...p, opponentAbbr: p.weekKey === "w1" ? "LV" : null }));
    expect(marginBars(withOpponent)[0]).toEqual({
      key: "w1",
      short: "W1",
      label: "Week 1 vs LV",
      value: 7,
      display: "+7 (24-17)",
    });
    expect(streakBars(points)[1]).toMatchObject({ label: "Week 2", value: -1, display: "L1" });
    expect(pointsWeeks(points)[1]).toMatchObject({ pointsFor: 10, pointsAgainst: 13 });
    expect(
      meetingBars([
        { id: "b", year: 2027, weekKey: "w2", us: 10, them: 20 },
        { id: "a", year: 2026, weekKey: "w9", us: 27, them: 24 },
      ]).map((m) => [m.key, m.short, m.value]),
    ).toEqual([
      ["a", "'26 W9", 3],
      ["b", "'27 W2", -10],
    ]);
  });
});

describe("calendarEntries", () => {
  test("places games on their Sundays with results, byes and the offseason", () => {
    const base = { us: null, them: null, result: null, userIsHome: null, opponentAbbr: null };
    const entries = calendarEntries(2026, [
      {
        ...base,
        _id: "g1",
        weekKey: "w1",
        status: "played",
        result: "W",
        us: 31,
        them: 17,
        userIsHome: true,
        opponentAbbr: "LV",
      },
      {
        ...base,
        _id: "g3",
        weekKey: "w3",
        status: "played",
        result: "L",
        us: 20,
        them: 23,
        userIsHome: false,
        opponentAbbr: "PIT",
      },
      { ...base, _id: "g4", weekKey: "w4", status: "bye" },
      { ...base, _id: "g9", weekKey: "wc", status: "scheduled", opponentAbbr: "BUF" },
    ]);
    expect(entries.get("2026-09-13")).toMatchObject({
      tag: "W1",
      detail: "vs LV · W 31-17",
      tone: "win",
      gameId: "g1",
    });
    expect(entries.get("2026-09-27")).toMatchObject({ detail: "at PIT · L 20-23", tone: "loss" });
    expect(entries.get("2026-10-04")).toMatchObject({ detail: "Bye week", tone: "bye", gameId: undefined });
    expect(entries.get("2027-01-17")).toMatchObject({ tag: "WC", tone: "upcoming", playoff: true });
    expect(entries.get("2027-04-29")).toMatchObject({ tag: "Draft", tone: "marker" });
  });
});
