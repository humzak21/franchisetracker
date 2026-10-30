import { describe, expect, test } from "vitest";
import type { WeekKey } from "../domain/calendar";
import { inCareerOrder, runningTotals, type LoggedGame } from "./ledger";
import { marksInGame, markTitle, playerMarks, reachedMarks } from "./marks";
import { paceTargets, pythagoreanWins, seasonPace, teamPace } from "./pace";
import { bestSpans, mergeSpanEntries, spanEntry } from "./spans";
import type { StatLine } from "./registry";
import { careerShape, yearOverYear } from "./yoy";

const game = (n: number, stats: StatLine, year = 2026): LoggedGame => ({
  gameId: `g${year}-${n}`,
  seasonId: `s${year}`,
  year,
  weekKey: `w${n}` as WeekKey,
  stats,
});

const rushing = (...yards: number[]) => yards.map((rushYds, i) => game(i + 1, { rushYds }));

describe("running totals", () => {
  test("add up in career order, whatever order the lines arrive in", () => {
    const lines = [game(2, { rushYds: 50 }), game(1, { rushYds: 100 }, 2027), game(1, { rushYds: 10 })];
    const running = runningTotals(lines, "rushYds");
    expect(running.map((r) => r.total)).toEqual([10, 60, 160]);
    expect(running.map((r) => [r.careerGame, r.seasonGame])).toEqual([
      [1, 1],
      [2, 2],
      [3, 1],
    ]);
  });

  test("a derived stat counts too, and a game without the stat counts zero", () => {
    const running = runningTotals([game(1, { rushYds: 40, recYds: 60 }), game(2, {})], "scrimmageYds");
    expect(running.map((r) => r.total)).toEqual([100, 100]);
  });

  test("career order sorts by year then week", () => {
    expect(inCareerOrder([game(1, {}, 2027), game(3, {})]).map((l) => l.year)).toEqual([2026, 2027]);
  });
});

describe("marks", () => {
  test("names the game each mark was crossed in", () => {
    const reached = reachedMarks(rushing(600, 300, 200), "rushYds");
    expect(reached).toEqual([
      expect.objectContaining({ mark: 1000, gamesToReach: 3, gameId: "g2026-3", weekKey: "w3" }),
    ]);
  });

  test("a mark hit exactly counts", () => {
    expect(reachedMarks(rushing(1000), "rushYds")[0]?.gamesToReach).toBe(1);
  });

  test("imported seasons are a starting total and a game count", () => {
    const start = { totals: [{ rushYds: 4800 }], games: 60 };
    const reached = reachedMarks(rushing(100, 150), "rushYds", start);
    expect(reached).toEqual([expect.objectContaining({ mark: 5000, gamesToReach: 62 })]);
  });

  test("a mark the imported seasons already passed has no game to name", () => {
    const start = { totals: [{ rushYds: 2500 }], games: 40 };
    expect(reachedMarks(rushing(100), "rushYds", start)).toEqual([]);
  });

  test("every horizon counts from its own start", () => {
    const imported = [
      { teamId: "NE", gamesPlayed: 17, totals: { rushYds: 700 } },
      { teamId: "BUF", gamesPlayed: 17, totals: { rushYds: 900 } },
    ];
    const lines = [game(1, { rushYds: 450 }), game(2, { rushYds: 600 })];
    const marks = playerMarks(lines, imported, "NE");
    const of = (horizon: string) => marks.filter((m) => m.statKey === "rushYds" && m.horizon === horizon);
    expect(of("career").map((m) => [m.mark, m.gamesToReach])).toEqual([[2000, 35]]);
    expect(of("team").map((m) => [m.mark, m.gamesToReach])).toEqual([[1000, 18]]);
    expect(of("season").map((m) => [m.mark, m.gamesToReach])).toEqual([[1000, 2]]);
  });

  test("the season horizon restarts each year", () => {
    const lines = [game(1, { rushYds: 1000 }), game(1, { rushYds: 1000 }, 2027)];
    const seasons = playerMarks(lines, [], "NE").filter(
      (m) => m.horizon === "season" && m.statKey === "rushYds",
    );
    expect(seasons.map((m) => m.seasonId)).toEqual(["s2026", "s2027"]);
  });

  test("one line per mark in a game, career first", () => {
    const marks = playerMarks(rushing(1000), [], "NE");
    const lines = marksInGame(marks, "g2026-1");
    expect(lines.filter((m) => m.statKey === "rushYds")).toEqual([
      expect.objectContaining({ horizon: "career", mark: 1000 }),
    ]);
    expect(markTitle("T. Henderson", { statKey: "rushYds", mark: 1000, gamesToReach: 12 })).toBe(
      "T. Henderson: 1,000 rushing yards in 12 games",
    );
  });
});

describe("best spans", () => {
  test("slides over the games and finds the best window", () => {
    const { best } = bestSpans(rushing(10, 100, 120, 20, 90), "rushYds", 2);
    expect(best).toMatchObject({ value: 220, crossesSeasons: false });
    expect(best?.start.gameId).toBe("g2026-2");
    expect(best?.end.gameId).toBe("g2026-3");
  });

  test("the second best shares no game with the best", () => {
    const { second } = bestSpans(rushing(10, 100, 120, 20, 90), "rushYds", 2);
    expect(second).toMatchObject({ value: 110 });
    expect(second?.start.gameId).toBe("g2026-4");
  });

  test("a span says when it crosses seasons", () => {
    const lines = [game(17, { rushYds: 100 }), game(1, { rushYds: 100 }, 2027)];
    expect(bestSpans(lines, "rushYds", 2).best?.crossesSeasons).toBe(true);
  });

  test("too few games or a zero is no span", () => {
    expect(bestSpans(rushing(100), "rushYds", 2).best).toBeNull();
    expect(bestSpans(rushing(0, 0), "rushYds", 2).best).toBeNull();
  });

  test("a tie goes to the earliest window", () => {
    expect(bestSpans(rushing(50, 50, 50), "rushYds", 2).best?.start.gameId).toBe("g2026-1");
  });

  test("a correction replaces the player's entries, even with a lower number", () => {
    const span = (playerId: string, value: number) =>
      spanEntry(playerId, {
        value,
        start: game(1, {}),
        end: game(2, {}),
        crossesSeasons: false,
      });
    const board = mergeSpanEntries([span("a", 300), span("b", 200)], new Set(["a"]), [span("a", 100)]);
    expect(board.map((e) => [e.playerId, e.value])).toEqual([
      ["b", 200],
      ["a", 100],
    ]);
    expect(mergeSpanEntries(board, new Set(["a"]), []).map((e) => e.playerId)).toEqual(["b"]);
  });
});

describe("pace", () => {
  test("projects a full season, and says nothing before a game", () => {
    expect(seasonPace(500, 5, 17)).toBe(1700);
    expect(seasonPace(0, 0, 17)).toBeNull();
  });

  test("checks targets and the rate still needed", () => {
    const [record, reached] = paceTargets(800, 8, 17, [
      { key: "record", target: 1800 },
      { key: "easy", target: 500 },
    ]);
    expect(record).toMatchObject({ projected: 1700, onPace: false, perGameNeeded: 1000 / 9 });
    expect(reached).toMatchObject({ onPace: true, perGameNeeded: 0 });
  });

  test("with no games left a target has no rate", () => {
    expect(paceTargets(800, 17, 17, [{ key: "x", target: 900 }])[0]?.perGameNeeded).toBeNull();
  });

  test("pythagorean wins follow the points", () => {
    expect(pythagoreanWins(400, 400, 17)).toBeCloseTo(8.5);
    expect(pythagoreanWins(500, 300, 17)!).toBeGreaterThan(12);
    expect(pythagoreanWins(0, 0, 0)).toBeNull();
  });

  test("the team's record projects forward", () => {
    const sofar = { wins: 6, losses: 2, ties: 0, pointsFor: 200, pointsAgainst: 160 };
    expect(teamPace(sofar, 16)).toMatchObject({ wins: 12, losses: 4, pointsFor: 400 });
    expect(teamPace({ ...sofar, wins: 0, losses: 0 }, 17)).toBeNull();
  });
});

describe("year over year", () => {
  const seasons = [
    { year: 2027, gamesPlayed: 2, totals: { rushYds: 900 } },
    { year: 2026, gamesPlayed: 17, totals: { rushYds: 600 } },
    { year: 2028, gamesPlayed: 17, totals: { rushYds: 1200 } },
  ];

  test("each season against the one before, a short season flagged on both sides", () => {
    const rows = yearOverYear(seasons, "rushYds");
    expect(rows[0]).toMatchObject({ year: 2026, delta: null, smallSample: false });
    expect(rows[1]).toMatchObject({ year: 2027, delta: 300, percent: 50, smallSample: true });
    expect(rows[2]).toMatchObject({ year: 2028, delta: 300, smallSample: true });
  });

  test("a change from zero has a delta and no percent", () => {
    const [, second] = yearOverYear(
      [
        { year: 2026, gamesPlayed: 17, totals: {} },
        { year: 2027, gamesPlayed: 17, totals: { rushYds: 100 } },
      ],
      "rushYds",
    );
    expect(second).toMatchObject({ delta: 100, percent: null });
  });

  test("the career's shape names the peak and the ages", () => {
    const shape = careerShape(seasons, "rushYds", 2003);
    expect(shape.peak).toEqual({ year: 2028, value: 1200 });
    expect(shape.ages[0]).toMatchObject({ year: 2026, age: 23 });
    expect(careerShape(seasons, "rushYds", undefined).ages[0]?.age).toBeNull();
    expect(careerShape([], "rushYds", undefined).peak).toBeNull();
  });
});
