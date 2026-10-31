import { describe, expect, test } from "vitest";
import type { GameResult, WeekKey } from "../domain/calendar";
import { meetingHighs, PERFORMERS_SHOWN, performersAgainst } from "./rivalry";

const game = (year: number, weekKey: WeekKey, us: number, them: number) => {
  const result: GameResult = us > them ? "W" : us < them ? "L" : "T";
  return { gameId: `${year}${weekKey}`, year, weekKey, us, them, result };
};

describe("the games that stand out", () => {
  const games = [
    game(2028, "w9", 10, 38),
    game(2027, "w3", 31, 7),
    game(2027, "w12", 17, 14),
    game(2028, "w2", 21, 24),
    game(2029, "w2", 42, 41),
    game(2029, "w9", 20, 20),
    game(2030, "w1", 24, 21),
  ];

  test("reads the biggest margins and scores in any order", () => {
    const highs = meetingHighs(games);
    expect(highs.bestWin?.gameId).toBe("2027w3");
    expect(highs.worstLoss?.gameId).toBe("2028w9");
    expect(highs.mostScored?.gameId).toBe("2029w2");
    expect(highs.mostAllowed?.gameId).toBe("2029w2");
  });

  test("a run goes by the calendar, and a tie ends it", () => {
    expect(meetingHighs(games)).toMatchObject({ longestWin: 2, longestLoss: 2 });
  });

  test("no games, nothing to say", () => {
    expect(meetingHighs([])).toEqual({
      bestWin: null,
      worstLoss: null,
      mostScored: null,
      mostAllowed: null,
      longestWin: 0,
      longestLoss: 0,
    });
  });

  test("a side that never won has no best win", () => {
    expect(meetingHighs([game(2027, "w1", 3, 7)]).bestWin).toBeNull();
  });
});

describe("our best against them", () => {
  const line = (playerId: string, gameId: string, rushYds: number) => ({
    playerId,
    gameId,
    stats: { rushYds },
  });

  test("adds up each player and finds the best single game", () => {
    const [rushing] = performersAgainst([line("a", "g1", 80), line("a", "g2", 90), line("b", "g1", 120)]);
    expect(rushing).toMatchObject({
      stat: "rushYds",
      rows: [
        { playerId: "a", value: 170, games: 2 },
        { playerId: "b", value: 120, games: 1 },
      ],
      best: { playerId: "b", value: 120, gameId: "g1" },
    });
  });

  test("keeps the list short, and leaves off a stat nobody has", () => {
    const lines = ["a", "b", "c", "d", "e"].map((p, i) => line(p, "g1", 10 + i));
    const all = performersAgainst(lines);
    expect(all).toHaveLength(1);
    expect(all[0]?.rows).toHaveLength(PERFORMERS_SHOWN);
  });
});
