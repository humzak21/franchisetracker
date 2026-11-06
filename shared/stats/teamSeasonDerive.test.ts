import { describe, expect, test } from "vitest";
import { deriveTeamSeason } from "./teamSeasonDerive";

describe("deriveTeamSeason", () => {
  test("points average every scored game; the rest only games with team stats", () => {
    const totals = deriveTeamSeason([
      {
        pointsFor: 31,
        pointsAgainst: 17,
        own: {
          passYds: 280,
          rushYds: 120,
          totalYds: 450,
          firstDowns: 24,
          thirdDownConv: 6,
          thirdDownAtt: 12,
          redZoneTd: 3,
          redZoneAtt: 4,
          turnovers: 1,
          penalties: 5,
        },
        opponent: { passYds: 200, rushYds: 90, sacksAllowed: 3, turnovers: 2 },
      },
      {
        pointsFor: 20,
        pointsAgainst: 24,
        own: {
          passYds: 220,
          rushYds: 80,
          firstDowns: 18,
          thirdDownConv: 3,
          thirdDownAtt: 12,
          redZoneTd: 1,
          redZoneAtt: 4,
          intThrown: 2,
          fumblesLost: 1,
          penalties: 7,
        },
        opponent: { passYds: 260, rushYds: 130, sacksAllowed: 1, turnovers: 0 },
      },
      { pointsFor: 10, pointsAgainst: 13, own: null, opponent: null },
    ]);
    expect(totals.games).toBe(3);
    expect(totals.statGames).toBe(2);
    expect(totals.stats).toEqual({
      pointsPg: 61 / 3,
      pointsAllowedPg: 54 / 3,
      // Offensive yards: passing plus rushing, never Madden's return-inclusive total.
      yardsPg: 350,
      passYardsPg: 250,
      rushYardsPg: 100,
      firstDownsPg: 21,
      thirdDownPct: 37.5,
      redZonePct: 50,
      penaltiesPg: 6,
      yardsAllowedPg: 340,
      passYardsAllowedPg: 230,
      rushYardsAllowedPg: 110,
      sacks: 4,
      takeaways: 2,
      giveaways: 4,
      turnoverDiff: -2,
    });
  });

  test("stats no game recorded are left out rather than zero", () => {
    const totals = deriveTeamSeason([
      { pointsFor: 14, pointsAgainst: 7, own: { passYds: 150 }, opponent: null },
    ]);
    expect(totals.stats).toEqual({ pointsPg: 14, pointsAllowedPg: 7, passYardsPg: 150 });
    expect(totals.statGames).toBe(1);
  });

  test("sums a league team stats line: own side for offense, the opponent's for defense", () => {
    const { league } = deriveTeamSeason([
      {
        pointsFor: 24,
        pointsAgainst: 10,
        own: { passYds: 250, rushYds: 100, totalYds: 380, thirdDownConv: 5, thirdDownAtt: 11, intThrown: 1 },
        opponent: { passYds: 180, rushYds: 70, sacksAllowed: 2, intThrown: 2, fumblesLost: 1, redZoneTd: 1 },
      },
      {
        pointsFor: 17,
        pointsAgainst: 20,
        own: { passYds: 200, rushYds: 90, thirdDownConv: 4, thirdDownAtt: 12, intThrown: 0 },
        opponent: { passYds: 220, rushYds: 110, sacksAllowed: 3, intThrown: 0, fumblesLost: 0 },
      },
    ]);
    expect(league).toEqual({
      pointsPg: 20.5,
      pointsAllowed: 30,
      passYds: 450,
      rushYds: 190,
      thirdDownConv: 9,
      thirdDownAtt: 23,
      passYdsAllowed: 400,
      rushYdsAllowed: 180,
      sacks: 5,
      defInt: 2,
      fumblesRecovered: 1,
    });
  });

  test("a rate's made and tried only count the games that recorded both", () => {
    const { league } = deriveTeamSeason([
      { pointsFor: 7, pointsAgainst: 3, own: { redZoneTd: 2, redZoneAtt: 3, redZoneFg: 1 }, opponent: null },
      { pointsFor: 7, pointsAgainst: 3, own: { redZoneTd: 3 }, opponent: null },
      { pointsFor: 7, pointsAgainst: 3, own: { redZoneTd: 1, redZoneAtt: 2 }, opponent: null },
    ]);
    expect(league).toMatchObject({ redZoneTd: 3, redZoneAtt: 5, redZoneFg: 1 });
  });

  test("no games, nothing derived", () => {
    expect(deriveTeamSeason([])).toEqual({ games: 0, statGames: 0, stats: {}, league: {} });
  });
});
