import { describe, expect, test } from "vitest";
import type { WeekKey } from "../domain/calendar";
import type { PlayLike } from "../games/scoringPlay";
import { buildScoringBoards, connectionMarksCrossed, type ScoredGame } from "./scoringBoards";

const us = "NE";
const them = "BUF";

const td = (over: Partial<PlayLike> & Pick<PlayLike, "homeScore" | "awayScore">): PlayLike => ({
  period: 1,
  clock: 600,
  teamId: us,
  kind: "rush_td",
  ...over,
});

const game = (gameId: string, year: number, weekKey: WeekKey, plays: PlayLike[], home = us): ScoredGame => ({
  gameId,
  seasonId: `s${year}`,
  year,
  weekKey,
  homeTeamId: home,
  awayTeamId: home === us ? them : us,
  plays,
});

const WIN = game("g1", 2026, "w1", [
  td({ teamId: them, kind: "fg", homeScore: 0, awayScore: 3 }),
  td({
    period: 2,
    kind: "pass_td",
    yards: 40,
    playerId: "wr",
    passerId: "qb",
    homeScore: 7,
    awayScore: 3,
  }),
  td({
    period: 2,
    clock: 100,
    playerId: "wr",
    kind: "pass_td",
    passerId: "qb",
    yards: 5,
    homeScore: 14,
    awayScore: 3,
  }),
]);

const LOSS = game("g2", 2026, "w2", [
  td({ playerId: "hb", yards: 60, homeScore: 7, awayScore: 0 }),
  td({ period: 3, teamId: them, homeScore: 7, awayScore: 7 }),
  td({ period: 4, teamId: them, homeScore: 7, awayScore: 14 }),
]);

describe("scoring boards", () => {
  const boards = buildScoringBoards([WIN, LOSS], us).regular;

  test("the longest of each kind, one entry per play, best first", () => {
    expect(boards.longest_pass_td?.map((e) => e.value)).toEqual([40, 5]);
    expect(boards.longest_pass_td?.[0]).toMatchObject({ playerId: "wr", passerId: "qb", gameId: "g1" });
    expect(boards.longest_rush_td?.[0]).toMatchObject({ playerId: "hb", value: 60 });
  });

  test("most touchdowns in a quarter finds the quarter", () => {
    expect(boards.tds_in_quarter?.[0]).toMatchObject({ playerId: "wr", value: 2, period: 2 });
  });

  test("game-winners count only the user's wins, by season and career", () => {
    expect(boards.game_winners_season).toEqual([
      expect.objectContaining({ playerId: "wr", value: 1, year: 2026 }),
    ]);
    const later = game("g3", 2027, "w1", [td({ playerId: "wr", homeScore: 7, awayScore: 0 })]);
    const both = buildScoringBoards([WIN, later], us).regular;
    expect(both.game_winners_career?.[0]).toMatchObject({ playerId: "wr", value: 2, year: 2027 });
    expect(both.game_winners_season?.map((e) => e.value)).toEqual([1, 1]);
  });

  test("connections add up across games", () => {
    expect(boards.connection_career?.[0]).toMatchObject({ playerId: "wr", passerId: "qb", value: 2 });
  });

  test("an empty list is left out rather than stored empty", () => {
    expect(boards.longest_punt_return_td).toBeUndefined();
  });
});

test("playoffs stand apart, and the preseason counts for nothing", () => {
  const playoff = game("g4", 2026, "wc", [td({ playerId: "hb", yards: 9, homeScore: 7, awayScore: 0 })]);
  const preseason = game("g5", 2026, "pre1", [td({ playerId: "hb", yards: 90, homeScore: 7, awayScore: 0 })]);
  const boards = buildScoringBoards([playoff, preseason], us);
  expect(boards.postseason.longest_rush_td?.[0]?.value).toBe(9);
  expect(boards.regular.longest_rush_td).toBeUndefined();
});

test("an away game reads from the user's side", () => {
  const away = game("g6", 2026, "w3", [td({ teamId: us, homeScore: 0, awayScore: 7, playerId: "hb" })], them);
  const boards = buildScoringBoards([away], us).regular;
  expect(boards.game_winners_season?.[0]).toMatchObject({ playerId: "hb", value: 1 });
});

test("a connection crossing a mark is reported once", () => {
  expect(connectionMarksCrossed(9, 10)).toEqual([10]);
  expect(connectionMarksCrossed(10, 11)).toEqual([]);
  expect(connectionMarksCrossed(24, 51)).toEqual([25, 50]);
});
