import { describe, expect, it } from "vitest";
import {
  LEAGUE_TEAM_STATS,
  leagueTeamColumnDef,
  leagueTeamValue,
  type LeagueTeamLine,
  type LeagueTeamStatKey,
} from "./leagueTeamRegistry";
import { LEAGUE_TEAM_TAB_DEFS, LEAGUE_TEAM_TABS, leagueTeamColumns, rawKeysInTab } from "./leagueTeamTabs";

// The 2026 Patriots across Madden's tabs (17 games).
const patriots: LeagueTeamLine = {
  totalYds: 8610,
  passYds: 4454,
  rushYds: 3697,
  pointsPg: 39.5,
  passTd: 56,
  rushTd: 39,
  passYdsAllowed: 4072,
  rushYdsAllowed: 1855,
  pointsAllowed: 510,
  intThrown: 15,
  fumblesLost: 6,
  defInt: 5,
  fumblesRecovered: 5,
  redZoneAtt: 84,
  redZoneTd: 62,
  redZoneFg: 1,
  thirdDownConv: 82,
  thirdDownAtt: 130,
};
const value = (key: LeagueTeamStatKey, line = patriots, perGame = false) =>
  leagueTeamValue(key, line, { games: 17 }, perGame);

describe("league team stats", () => {
  it("derives what Madden prints from the counts beside it", () => {
    expect([value("giveaways"), value("takeaways"), value("turnoverDiff")]).toEqual([21, 10, -11]);
    expect(value("offYds")).toBe(8151);
    expect(value("yardsAllowed")).toBe(5927);
    expect(value("redZonePct")).toBeCloseTo(73.8, 1);
    expect(value("thirdDownPct")).toBeCloseTo(63.1, 1);
  });

  it("works out what Madden leaves out: OPPG, points, differentials, return yards", () => {
    expect(value("pointsAllowedPg")).toBe(30);
    // 39.5 points a game over 17 games.
    expect(value("pointsFor")).toBe(672);
    expect(value("pointDiff")).toBe(162);
    expect(value("yardsDiff")).toBe(8151 - 5927);
    expect(value("returnYds")).toBe(459);
    expect(value("totalTd")).toBe(95);
    expect(value("redZoneScorePct")).toBeCloseTo(75, 0);
  });

  it("reads any count per game, and leaves rates alone", () => {
    expect(value("passYds", patriots, true)).toBeCloseTo(262, 0);
    expect(value("pointDiff", patriots, true)).toBeCloseTo(9.5, 1);
    expect(value("pointsPg", patriots, true)).toBe(39.5);
    expect(value("thirdDownPct", patriots, true)).toBeCloseTo(63.1, 1);
    expect(leagueTeamColumnDef("passYds", true)).toMatchObject({ abbr: "PASS/G", format: "decimal" });
    expect(leagueTeamColumnDef("pointsAllowedPg", true).abbr).toBe("OPPG");
  });

  it("leaves a derived stat empty until every input was captured", () => {
    expect(value("turnoverDiff", { intThrown: 3, fumblesLost: 1 })).toBeNull();
    expect(value("offYds", { passYds: 5590 })).toBeNull();
    expect(value("pointDiff", { pointsPg: 20 })).toBeNull();
    expect(value("passYds", {}, true)).toBeNull();
  });

  it("lays every tab out with its phone and lead columns among its own", () => {
    for (const tab of LEAGUE_TEAM_TABS) {
      const def = LEAGUE_TEAM_TAB_DEFS[tab];
      for (const key of [...def.phone, def.lead]) expect(def.columns).toContain(key);
      for (const key of def.columns) expect(LEAGUE_TEAM_STATS[key].abbr.length).toBeGreaterThan(0);
    }
    expect(rawKeysInTab("turnovers")).toEqual(["intThrown", "fumblesLost", "defInt", "fumblesRecovered"]);
  });

  it("shows a season total and its per-game twin once per game", () => {
    expect(leagueTeamColumns("defense", false)).toContain("pointsAllowed");
    expect(leagueTeamColumns("defense", true)).not.toContain("pointsAllowed");
    expect(leagueTeamColumns("defense", true)).toContain("pointsAllowedPg");
    expect(leagueTeamColumns("offense", true)).not.toContain("pointsFor");
  });
});
