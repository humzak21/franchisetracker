import { describe, expect, it } from "vitest";
import {
  recordBefore,
  resultOf,
  seasonSummary,
  sortByWeek,
  streak,
  userScore,
  type GameLike,
} from "./summary";

const game = (weekKey: GameLike["weekKey"], us: number, them: number, userIsHome = true): GameLike => ({
  weekKey,
  status: "played",
  userIsHome,
  homeScore: userIsHome ? us : them,
  awayScore: userIsHome ? them : us,
});

const season: GameLike[] = [
  game("w10", 20, 23),
  game("w1", 31, 17),
  { weekKey: "w4", status: "bye" },
  game("w2", 27, 24, false),
  game("w3", 17, 17),
  game("wc", 30, 10),
  game("pre1", 3, 40),
];

describe("game math", () => {
  it("reads scores from the user's side", () => {
    expect(userScore(game("w1", 27, 24, false))).toEqual({ us: 27, them: 24 });
    expect(userScore({ weekKey: "w4", status: "bye" })).toBeNull();
    expect(resultOf(game("w3", 17, 17))).toBe("T");
  });

  it("orders weeks chronologically, not alphabetically", () => {
    expect(sortByWeek(season).map((g) => g.weekKey)).toEqual(["pre1", "w1", "w2", "w3", "w4", "w10", "wc"]);
  });

  it("summarizes a season without preseason games", () => {
    expect(seasonSummary(season)).toEqual({
      regular: { w: 2, l: 1, t: 1 },
      postseason: { w: 1, l: 0, t: 0 },
      pointsFor: 125,
      pointsAgainst: 91,
      streak: "W1",
    });
  });

  it("counts the current streak from the newest result", () => {
    expect(streak([game("w1", 10, 20), game("w2", 30, 20), game("w3", 24, 21)])).toBe("W2");
    expect(streak([])).toBeNull();
  });

  it("gives the record entering a week", () => {
    expect(recordBefore(season, "w10")).toEqual({ w: 2, l: 0, t: 1 });
    expect(recordBefore(season, "w1")).toEqual({ w: 0, l: 0, t: 0 });
  });
});
