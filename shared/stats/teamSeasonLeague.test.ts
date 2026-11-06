import { describe, expect, it } from "vitest";
import {
  leagueStanding,
  leagueValues,
  teamSeasonFromLeague,
  teamSeasonStatsFromLeague,
  userLeagueLine,
  withLeagueStanding,
} from "./teamSeasonLeague";

describe("teamSeasonFromLeague", () => {
  it("reads per-game cards per game played and season cards as they are", () => {
    const team = { games: 10, line: { passYds: 2500, rushYds: 1000, pointsPg: 24.1, sacks: 30 } };
    expect(teamSeasonFromLeague("yardsPg", team)).toBe(350);
    expect(teamSeasonFromLeague("pointsPg", team)).toBe(24.1);
    expect(teamSeasonFromLeague("sacks", team)).toBe(30);
  });

  it("is null for a stat the league screen does not have, or a missing tab", () => {
    const team = { games: 10, line: { passYds: 2500 } };
    expect(teamSeasonFromLeague("penaltiesPg", team)).toBeNull();
    expect(teamSeasonFromLeague("yardsPg", team)).toBeNull();
  });
});

describe("teamSeasonStatsFromLeague", () => {
  it("gives every card the line has", () => {
    expect(teamSeasonStatsFromLeague({ games: 10, line: { passYds: 2500, sacks: 30 } })).toEqual({
      passYardsPg: 250,
      sacks: 30,
    });
  });
});

describe("leagueStanding", () => {
  const others = [30, 28, 25, 22, 20, 18, 15];

  it("ranks by the stat's good direction with the league average", () => {
    expect(leagueStanding("pointsPg", 26, others)).toEqual({
      rank: 3,
      tied: false,
      of: 8,
      average: (30 + 28 + 25 + 22 + 20 + 18 + 15 + 26) / 8,
    });
    expect(leagueStanding("pointsAllowedPg", 26, others)?.rank).toBe(6);
  });

  it("ties values that print the same", () => {
    expect(leagueStanding("pointsPg", 25.04, others)).toMatchObject({ rank: 3, tied: true });
  });

  it("needs enough teams to call it a league", () => {
    expect(leagueStanding("pointsPg", 26, others.slice(0, 3))).toBeNull();
  });
});

describe("leagueValues", () => {
  it("leaves out teams without the stat", () => {
    expect(
      leagueValues("sacks", [
        { games: 17, line: { sacks: 40 } },
        { games: 17, line: {} },
      ]),
    ).toEqual([40]);
  });
});

describe("userLeagueLine", () => {
  it("keeps every number the league screen printed and fills the rest from the games", () => {
    expect(userLeagueLine({ passYds: 4000 }, { passYds: 3900, sacks: 40 })).toEqual({
      line: { passYds: 4000, sacks: 40 },
      fromGames: true,
    });
    expect(userLeagueLine({ passYds: 4000, sacks: 41 }, { passYds: 3900, sacks: 40 })).toEqual({
      line: { passYds: 4000, sacks: 41 },
      fromGames: false,
    });
  });

  it("is null with neither", () => {
    expect(userLeagueLine(undefined, undefined)).toBeNull();
  });
});

describe("withLeagueStanding", () => {
  const league = [30, 28, 25, 22, 20, 18, 15].map((pointsPg) => ({ games: 17, line: { pointsPg } }));
  const point = { value: 26, tied: false, source: "games" as const };

  it("ranks a season among that year's league lines and keeps a captured rank", () => {
    const [trend] = withLeagueStanding(
      [
        {
          statKey: "pointsPg",
          points: [
            { ...point, year: 2026, rank: null },
            { ...point, year: 2027, rank: 4 },
            { ...point, year: 2028, rank: null },
          ],
        },
      ],
      new Map([
        [2026, league],
        [2027, league],
      ]),
    );
    expect(trend?.points.map((p) => [p.rank, p.of, p.rankFromLeague])).toEqual([
      [3, 8, true],
      [4, 8, false],
      [null, null, false],
    ]);
    expect(trend?.points[0]?.average).toBeCloseTo(23);
  });
});
