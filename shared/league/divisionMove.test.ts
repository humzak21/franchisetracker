import { describe, expect, test } from "vitest";
import type { WeekKey } from "../domain/calendar";
import { divisionMove, type DivisionTeam, type WeekScore } from "./divisionMove";

const members: DivisionTeam[] = ["PHI", "DAL", "NYG", "WAS"].map((teamAbbr) => ({
  teamAbbr,
  conference: "NFC",
  division: "East",
}));

const win = (weekKey: WeekKey, winner: string, loser: string): WeekScore => ({
  weekKey,
  home: winner,
  away: loser,
  homeScore: 24,
  awayScore: 10,
});

const week = (weekKey: WeekKey, first: string, second: string, third: string, fourth: string) => [
  win(weekKey, first, second),
  win(weekKey, third, fourth),
];

describe("how a week moved us in the division", () => {
  test("a win that passes a rival moves up, a loss falls back", () => {
    const games = [
      ...week("w1", "DAL", "PHI", "NYG", "WAS"),
      ...week("w2", "DAL", "NYG", "PHI", "WAS"),
      ...week("w3", "PHI", "DAL", "NYG", "WAS"),
      ...week("w4", "PHI", "DAL", "WAS", "NYG"),
      ...week("w5", "DAL", "PHI", "NYG", "WAS"),
    ];
    expect(divisionMove("PHI", members, games, "w3")).toEqual({ rank: 2, previous: 3 });
    expect(divisionMove("PHI", members, games, "w4")).toEqual({ rank: 1, previous: 2 });
    expect(divisionMove("PHI", members, games, "w5")).toEqual({ rank: 2, previous: 1 });
  });

  test("a place held reads the same both ways", () => {
    const games = [...week("w1", "PHI", "DAL", "WAS", "NYG"), ...week("w2", "PHI", "WAS", "DAL", "NYG")];
    expect(divisionMove("PHI", members, games, "w2")).toEqual({ rank: 1, previous: 1 });
  });

  test("the first week starts from an unplayed division", () => {
    const move = divisionMove("WAS", members, week("w1", "WAS", "NYG", "PHI", "DAL"), "w1");
    expect(move).toMatchObject({ rank: 2 });
  });

  test("a playoff week has no division place", () => {
    expect(divisionMove("PHI", members, [], "wc")).toBeNull();
  });

  test("rivals short of games mean the scores were not captured", () => {
    const own = [win("w1", "PHI", "BUF"), win("w2", "PHI", "MIA"), win("w3", "PHI", "NE")];
    expect(divisionMove("PHI", members, own, "w3")).toBeNull();
  });

  test("a rival one game short is only on a bye", () => {
    const games = [
      ...week("w1", "PHI", "DAL", "WAS", "NYG"),
      win("w2", "PHI", "WAS"),
      win("w2", "BUF", "NYG"),
    ];
    expect(divisionMove("PHI", members, games, "w2")).toEqual({ rank: 1, previous: 1 });
  });

  test("a team not in the division has no place", () => {
    expect(divisionMove("KC", members, [], "w1")).toBeNull();
  });
});
