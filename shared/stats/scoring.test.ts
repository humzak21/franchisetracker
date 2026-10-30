import { describe, expect, test } from "vitest";
import { lineScoreError } from "../games/lineScore";
import { describePlay, elapsedSeconds, formatClock, gameLength, type PlayLike } from "../games/scoringPlay";
import { connections, gameFlow, lineScoreFromPlays, touchdownsByPeriod, wormPoints } from "./scoring";

const play = (over: Partial<PlayLike> & Pick<PlayLike, "homeScore" | "awayScore">): PlayLike => ({
  period: 1,
  clock: 600,
  teamId: "NE",
  kind: "rush_td",
  ...over,
});

/** NE at home: trails 10-0 after three, wins 14-10 on a late touchdown. */
const COMEBACK: PlayLike[] = [
  play({ period: 1, clock: 300, teamId: "BUF", kind: "rush_td", homeScore: 0, awayScore: 7 }),
  play({ period: 3, clock: 120, teamId: "BUF", kind: "fg", homeScore: 0, awayScore: 10 }),
  play({ period: 4, clock: 500, teamId: "NE", kind: "pass_td", homeScore: 7, awayScore: 10, playerId: "a" }),
  play({ period: 4, clock: 40, teamId: "NE", kind: "pass_td", homeScore: 14, awayScore: 10, playerId: "b" }),
];

describe("line score", () => {
  test("adds up to the final by period, whatever order the plays arrive in", () => {
    const line = lineScoreFromPlays([...COMEBACK].reverse());
    expect(line).toEqual({ home: [0, 0, 0, 14], away: [7, 0, 3, 0] });
    expect(lineScoreError(line, { home: 14, away: 10 })).toBeNull();
  });

  test("an overtime score adds a column to both teams", () => {
    const line = lineScoreFromPlays([
      play({ period: 2, homeScore: 3, awayScore: 0, kind: "fg" }),
      play({ period: 2, clock: 10, teamId: "BUF", homeScore: 3, awayScore: 3, kind: "fg" }),
      play({ period: 5, homeScore: 9, awayScore: 3 }),
    ]);
    expect(line).toEqual({ home: [0, 3, 0, 0, 6], away: [0, 3, 0, 0, 0] });
  });
});

describe("game flow", () => {
  test("names the score that put the winner ahead for good, and the comeback", () => {
    const flow = gameFlow(COMEBACK);
    expect(flow.winner).toBe("home");
    expect(flow.gameWinner?.playerId).toBe("b");
    expect(flow.firstScore).toBe("away");
    expect(flow.deficitOvercome).toBe(10);
    expect(flow.comeback).toBe(true);
    expect(flow.leadChanges).toBe(1);
  });

  test("a wire-to-wire win is won by the first score", () => {
    const flow = gameFlow([
      play({ homeScore: 7, awayScore: 0, playerId: "first" }),
      play({ period: 2, teamId: "BUF", kind: "fg", homeScore: 7, awayScore: 3 }),
    ]);
    expect(flow.gameWinner?.playerId).toBe("first");
    expect(flow.deficitOvercome).toBe(0);
    expect(flow.comeback).toBe(false);
  });

  test("a tie counts and goes back to who broke it", () => {
    const flow = gameFlow([
      play({ homeScore: 7, awayScore: 0 }),
      play({ period: 2, teamId: "BUF", homeScore: 7, awayScore: 7 }),
      play({ period: 3, homeScore: 14, awayScore: 7, playerId: "breaker" }),
    ]);
    expect(flow.ties).toBe(1);
    expect(flow.gameWinner?.playerId).toBe("breaker");
  });

  test("a tied game and a game with no plays have no winner", () => {
    expect(gameFlow([]).winner).toBeNull();
    const flow = gameFlow([play({ homeScore: 3, awayScore: 3, kind: "fg" })]);
    expect(flow.winner).toBeNull();
    expect(flow.gameWinner).toBeNull();
  });
});

describe("score worm", () => {
  test("starts level, steps at each score from the user's side and holds to the whistle", () => {
    const points = wormPoints(COMEBACK, false);
    expect(points.at(0)).toEqual({ seconds: 0, margin: 0, playIndex: null });
    expect(points[1]).toEqual({ seconds: 600, margin: 7, playIndex: 0 });
    expect(points.at(-1)).toEqual({ seconds: 3600, margin: -4, playIndex: null });
  });

  test("overtime runs past regulation on the same clock", () => {
    expect(elapsedSeconds(5, 300)).toBe(3600 + 300);
    expect(gameLength(5)).toBe(4200);
  });
});

test("touchdowns by period leave field goals out", () => {
  const counts = touchdownsByPeriod([
    { period: 2, kind: "pass_td" },
    { period: 2, kind: "rush_td" },
    { period: 2, kind: "fg" },
  ]);
  expect(counts.get(2)).toBe(2);
});

test("connections pair passer and scorer, most touchdowns first", () => {
  const pairs = connections([
    play({ kind: "pass_td", passerId: "qb", playerId: "wr1", yards: 10, homeScore: 7, awayScore: 0 }),
    play({ kind: "pass_td", passerId: "qb", playerId: "wr2", yards: 20, homeScore: 14, awayScore: 0 }),
    play({ kind: "pass_td", passerId: "qb", playerId: "wr2", yards: 5, homeScore: 21, awayScore: 0 }),
    play({ kind: "pass_td", playerId: "wr3", homeScore: 28, awayScore: 0 }),
  ]);
  expect(pairs).toEqual([
    { passerId: "qb", playerId: "wr2", touchdowns: 2, yards: 25 },
    { passerId: "qb", playerId: "wr1", touchdowns: 1, yards: 10 },
  ]);
});

describe("a play in words", () => {
  test("reads from its fields, and still reads with a name missing", () => {
    expect(describePlay({ kind: "pass_td", yards: 15 }, { scorer: "K. Boutte", passer: "D. Maye" })).toBe(
      "K. Boutte 15 yd pass from D. Maye",
    );
    expect(describePlay({ kind: "pass_td", yards: 15 }, { scorer: null, passer: "D. Maye" })).toBe(
      "15 yd pass from D. Maye",
    );
    expect(describePlay({ kind: "safety" }, { scorer: null, passer: null })).toBe("safety");
  });

  test("the clock prints as m:ss", () => {
    expect(formatClock(725)).toBe("12:05");
    expect(formatClock(9)).toBe("0:09");
  });
});
