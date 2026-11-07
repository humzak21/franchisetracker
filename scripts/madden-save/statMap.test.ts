import { describe, expect, it } from "vitest";
import { RAW_STATS } from "../../shared/stats/registry";
import { TEAM_STATS } from "../../shared/stats/teamRegistry";
import { mapPlayerStats, mapTeamStats, PLAYER_STAT_SOURCES, TEAM_STAT_SOURCES } from "./statMap";

describe("stat sources", () => {
  it("name only registry keys", () => {
    for (const key of Object.keys(PLAYER_STAT_SOURCES)) expect(RAW_STATS).toHaveProperty(key);
    for (const key of Object.keys(TEAM_STAT_SOURCES)) expect(TEAM_STATS).toHaveProperty(key);
  });
});

describe("mapPlayerStats", () => {
  it("reads a quarterback's offensive row and keeps his zeros within passing", () => {
    const line = mapPlayerStats({
      PASSCOMPLETED: 25,
      PASSATTEMPTS: 34,
      PASSYARDS: 413,
      PASSTDS: 3,
      PASSINTS: 0,
      PASSSACKED: 2,
      PASSLONGEST: 55,
      RUSHATTEMPTS: 0,
      RUSHYARDS: 0,
      RUSHTDS: 0,
      RUSHLONGEST: 0,
      RUSHBROKENTACKLES: 0,
      RUSHFUMBLES: 0,
      RECEIVECATCHES: 0,
      RECEIVEYARDS: 0,
      RECEIVETDS: 0,
      RECEIVELONGEST: 0,
      RECEIVEYARDSAFTER: 0,
      RECEIVEDROPS: 0,
    });
    expect(line).toEqual({
      passCmp: 25,
      passAtt: 34,
      passYds: 413,
      passTd: 3,
      passInt: 0,
      passSacked: 2,
      passLong: 55,
    });
  });

  it("counts half sacks as half and both kinds of defensive touchdown", () => {
    const line = mapPlayerStats({
      DEFTACKLES: 4,
      DLINESACKS: 1,
      DLINEHALFSACK: 1,
      DSECINTTDS: 1,
      DLINEFUMBLETDS: 1,
    });
    expect(line.sacks).toBe(1.5);
    expect(line.defTd).toBe(2);
    expect(line).not.toHaveProperty("passAtt");
  });

  it("gives an empty line for a row with nothing in it", () => {
    expect(mapPlayerStats({ DEFTACKLES: 0, DLINESACKS: 0 })).toEqual({});
  });
});

describe("mapTeamStats", () => {
  it("totals passing and rushing and takes completions from the lines", () => {
    const line = mapTeamStats(
      {
        OFFPASSYARDS: 375,
        OFFRUSHYARDS: 101,
        PASSATTEMPTS: 36,
        RUSHATTEMPTS: 28,
        SACKSALLOWED: 6,
        POSSESSIONTIME: 1882,
      },
      25,
    );
    expect(line.totalYds).toBe(476);
    expect(line.plays).toBe(70);
    expect(line.passCmp).toBe(25);
    expect(line.possessionSec).toBe(1882);
    expect(line).not.toHaveProperty("firstDowns");
  });
});
