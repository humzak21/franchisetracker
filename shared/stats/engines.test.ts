import { describe, expect, it } from "vitest";
import { detectMilestones } from "./milestones";
import { rankStat, RECORD_STATS, type SeasonRow } from "./records";
import { playerStreaks, runs, teamStreaks } from "./streaks";

const rows: SeasonRow[] = [
  {
    playerId: "a",
    seasonId: "s1",
    year: 2026,
    totals: { rushYds: 900, rushLong: 60 },
    bests: { rushYds: 180 },
  },
  {
    playerId: "a",
    seasonId: "s2",
    year: 2027,
    totals: { rushYds: 1200, rushLong: 45 },
    bests: { rushYds: 150 },
  },
  {
    playerId: "b",
    seasonId: "s2",
    year: 2027,
    totals: { rushYds: 1200, rushLong: 70 },
    bests: { rushYds: 180 },
  },
];

describe("rankStat", () => {
  it("ranks games, seasons and careers, earliest first on ties", () => {
    expect(rankStat(rows, "rushYds", "game").map((e) => [e.playerId, e.value, e.year])).toEqual([
      ["a", 180, 2026],
      ["b", 180, 2027],
      ["a", 150, 2027],
    ]);
    expect(rankStat(rows, "rushLong", "game")[0]).toMatchObject({ playerId: "b", value: 70 });
    expect(rankStat(rows, "rushYds", "season")[0]).toMatchObject({ playerId: "a", year: 2027 });
    expect(rankStat(rows, "rushYds", "career")).toEqual([
      { playerId: "a", value: 2100, seasonId: "s2", year: 2027 },
      { playerId: "b", value: 1200, seasonId: "s2", year: 2027 },
    ]);
    expect(rankStat(rows, "recYds", "career")).toEqual([]);
  });

  it("only counts stats where more is better", () => {
    expect(RECORD_STATS).toContain("passYds");
    expect(RECORD_STATS).not.toContain("passInt");
  });
});

describe("streaks", () => {
  it("measures current and longest runs", () => {
    expect(runs([true, true, false, true])).toEqual({ current: 1, longest: 2 });
    expect(runs([])).toEqual({ current: 0, longest: 0 });
  });

  it("home and division streaks skip games they do not apply to", () => {
    const w = (home: boolean, division = false) => ({ result: "W" as const, home, division });
    const l = (home: boolean) => ({ result: "L" as const, home, division: false });
    const streaks = teamStreaks([w(true, true), l(false), w(true), w(false, true), w(true)]);
    expect(streaks).toEqual([
      { key: "wins", current: 3, longest: 3 },
      { key: "homeWins", current: 3, longest: 3 },
      { key: "divisionWins", current: 2, longest: 2 },
    ]);
  });

  it("player streaks count only the games they apply to", () => {
    const streaks = playerStreaks([
      { rushAtt: 20, rushYds: 120, rushTd: 1 },
      { rec: 3, recYds: 20 },
      { rushAtt: 18, rushYds: 101 },
    ]);
    expect(streaks).toEqual([{ key: "rush100", current: 2, longest: 2 }]);
  });
});

describe("detectMilestones", () => {
  const base = { name: "T. Henderson", priorSeasons: [], seasonBefore: {} };

  it("threshold games, career highs once there is a history, first threshold season", () => {
    const found = detectMilestones({
      ...base,
      line: { rushAtt: 25, rushYds: 160 },
      priorGames: [{ rushYds: 80 }, { rushYds: 120 }, { rushYds: 60 }],
      seasonBefore: { rushYds: 900 },
    });
    expect(found.map((m) => m.key)).toEqual(["game:rush100", "high:rushYds", "season:rushYds:1000"]);
    expect(found[1]?.title).toBe("T. Henderson: career-high 160 rushing yards");
    expect(found[2]?.title).toBe("T. Henderson: first season with 1,000 rushing yards");
  });

  it("no career high without history, no first season when one came before", () => {
    const found = detectMilestones({
      ...base,
      line: { rushYds: 160 },
      priorGames: [{ rushYds: 80 }],
      seasonBefore: { rushYds: 900 },
      priorSeasons: [{ rushYds: 1100 }],
    });
    expect(found.map((m) => m.kind)).toEqual(["threshold_game"]);
  });

  it("respects threshold overrides", () => {
    const found = detectMilestones({
      ...base,
      line: { rushYds: 60 },
      priorGames: [],
      seasonBefore: { rushYds: 480 },
      thresholds: { rushYds: { tier1: 500 } },
    });
    expect(found.map((m) => m.key)).toEqual(["season:rushYds:500"]);
  });
});
