import { describe, expect, it } from "vitest";
import {
  countdowns,
  nextMark,
  paceGoals,
  paceLine,
  paceRecord,
  playerPace,
  projectedGames,
  projectedLine,
  regularPoints,
  seasonInProgress,
  seasonLeaders,
} from "./hub";

describe("season pace", () => {
  it("only applies to a season under way", () => {
    expect(seasonInProgress("regular", 8, 17)).toBe(true);
    expect(seasonInProgress("regular", 0, 17)).toBe(false);
    expect(seasonInProgress("regular", 17, 17)).toBe(false);
    expect(seasonInProgress("postseason", 8, 17)).toBe(false);
    expect(seasonInProgress("complete", 8, 17)).toBe(false);
  });

  it("projects a record in whole games that adds up to the season", () => {
    expect(paceRecord({ w: 6, l: 2, t: 0 }, 17)).toEqual({ w: 13, l: 4, t: 0 });
    expect(paceRecord({ w: 3, l: 3, t: 2 }, 17)).toEqual({ w: 6, l: 7, t: 4 });
    expect(paceRecord({ w: 0, l: 0, t: 0 }, 17)).toBeNull();
  });

  it("writes the line a header shows, and nothing once there is no pace", () => {
    expect(paceLine({ w: 6, l: 2, t: 0 }, 208, "regular", 17)).toBe("On pace for 13-4, 442 points");
    expect(paceLine({ w: 13, l: 4, t: 0 }, 442, "complete", 17)).toBeNull();
    expect(paceLine({ w: 0, l: 0, t: 0 }, 0, "regular", 17)).toBeNull();
  });

  it("counts the regular season's points, not the playoffs'", () => {
    expect(
      regularPoints([
        { weekKey: "w1", pointsFor: 24, pointsAgainst: 10 },
        { weekKey: "pre1", pointsFor: 3, pointsAgainst: 3 },
        { weekKey: "div", pointsFor: 30, pointsAgainst: 28 },
      ]),
    ).toEqual({ pointsFor: 24, pointsAgainst: 10 });
  });
});

describe("player pace", () => {
  it("counts the games left on the team's schedule, so a missed game stays missed", () => {
    expect(playerPace(500, 5, 8, 17)).toBe(1400);
    expect(playerPace(800, 8, 8, 17)).toBe(1700);
    expect(playerPace(0, 0, 8, 17)).toBeNull();
    expect(projectedGames(5, 8, 17)).toBe(14);
  });

  it("scales counts and leaves a longest play alone", () => {
    expect(projectedLine({ rushYds: 400, rushLong: 61 }, 8, 8, 17)).toEqual({ rushYds: 850, rushLong: 61 });
  });
});

describe("seasonLeaders", () => {
  it("names who leads each slot and skips an empty one", () => {
    const rows = [
      { id: "qb", totals: { passYds: 3000, rushYds: 100 } },
      { id: "hb", totals: { rushYds: 900, recYds: 300 } },
    ];
    expect(seasonLeaders(rows).map((l) => [l.key, l.row.id, l.value])).toEqual([
      ["passing", "qb", 3000],
      ["scrimmage", "hb", 1200],
    ]);
  });
});

describe("countdowns", () => {
  it("finds the next mark, and none past the last", () => {
    expect(nextMark("rushYds", 912)).toBe(1000);
    expect(nextMark("rushYds", 1000)).toBe(2000);
    expect(nextMark("rushYds", 20000)).toBeNull();
  });

  it("ranks by games away at each player's rate, one mark per player", () => {
    const list = countdowns(
      [
        { id: "starter", games: 40, totals: { rushYds: 3910 } },
        { id: "backup", games: 40, totals: { rushYds: 990 } },
        { id: "qb", games: 34, totals: { passYds: 9800, passTd: 45 } },
      ],
      17,
    );
    expect(list.map((c) => [c.id, c.statKey, c.mark, c.remaining, c.gamesAway])).toEqual([
      ["backup", "rushYds", 1000, 10, 1],
      ["qb", "passYds", 10000, 200, 1],
      ["starter", "rushYds", 5000, 1090, 12],
    ]);
  });

  it("leaves out anything a season will not reach, and anyone with no games", () => {
    expect(countdowns([{ id: "a", games: 17, totals: { rushYds: 100 } }], 17)).toEqual([]);
    expect(countdowns([{ id: "a", games: 0, totals: { rushYds: 990 } }], 17)).toEqual([]);
  });
});

describe("paceGoals", () => {
  const input = {
    gamesPerSeason: 17,
    live: { year: 2028, teamGames: 8 },
    seasons: [
      { year: 2026, gamesPlayed: 17, totals: { recYds: 1300 } },
      { year: 2027, gamesPlayed: 17, totals: { recYds: 1100 } },
      { year: 2028, gamesPlayed: 8, totals: { recYds: 640 } },
    ],
    records: [{ statKey: "recYds", value: 1600 }],
  };

  it("lists what is left to chase, nearest first, with the pace to each", () => {
    const [row] = paceGoals(input, ["recYds"]);
    expect(row?.total).toBe(640);
    expect(row?.checks.map((c) => [c.key, c.target, c.onPace])).toEqual([
      ["mark", 1000, true],
      ["lastSeason", 1100, true],
      ["best", 1300, true],
      ["record", 1600, false],
    ]);
    expect(row?.checks[0]?.projected).toBe(1360);
    expect(row?.checks[3]?.perGameNeeded).toBeCloseTo(106.67, 1);
  });

  it("counts the games the team has left, so a missed game is not projected back", () => {
    const seasons = input.seasons.map((s) => (s.year === 2028 ? { ...s, gamesPlayed: 4 } : s));
    const [row] = paceGoals({ ...input, seasons }, ["recYds"]);
    expect(row?.checks[0]?.projected).toBe(640 + 160 * 9);
  });

  it("is empty with no live season, or for a stat not played", () => {
    expect(paceGoals({ ...input, live: null }, ["recYds"])).toEqual([]);
    expect(paceGoals(input, ["passYds"])).toEqual([]);
  });

  it("drops a target already passed", () => {
    const [row] = paceGoals({ ...input, records: [{ statKey: "recYds", value: 500 }] }, ["recYds"]);
    expect(row?.checks.map((c) => c.key)).not.toContain("record");
  });
});
