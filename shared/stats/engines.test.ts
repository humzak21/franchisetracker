import { describe, expect, it } from "vitest";
import type { WeekKey } from "../domain/calendar";
import { detectMilestones } from "./milestones";
import { rankStat, RECORD_STATS, type SeasonRow } from "./records";
import { playerStreaks, runs, seasonStreaks, teamStreaks, type TeamGame } from "./streaks";

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
  const at = (n: number) => ({ seasonId: "s", year: 2026, weekKey: `w${n}` as WeekKey });
  const seq = (flags: boolean[]) => flags.map((flag, i) => ({ at: at(i + 1), flag }));

  it("measures current and longest runs, with where each stands", () => {
    expect(runs(seq([true, true, false, true]), (x) => x.flag)).toEqual({
      current: 1,
      longest: 2,
      currentFrom: at(4),
      longestFrom: at(1),
      longestTo: at(2),
    });
    expect(runs(seq([]), (x) => x.flag)).toEqual({ current: 0, longest: 0 });
  });

  it("a streak that ended has no start, and a tie keeps the earliest run", () => {
    const ended = runs(seq([true, true, false, true, true, false]), (x) => x.flag);
    expect(ended.currentFrom).toBeUndefined();
    expect(ended).toMatchObject({ current: 0, longest: 2, longestFrom: at(1), longestTo: at(2) });
  });

  const game = (n: number, over: Partial<TeamGame>): TeamGame => ({
    at: at(n),
    result: "W",
    home: true,
    division: false,
    us: 24,
    them: 17,
    takeaways: null,
    ...over,
  });
  const summary = (s: { key: string; current: number; longest: number }) => [s.key, s.current, s.longest];

  it("home and division streaks skip games they do not apply to", () => {
    const streaks = teamStreaks([
      game(1, { division: true }),
      game(2, { result: "L", home: false }),
      game(3, {}),
      game(4, { home: false, division: true }),
      game(5, {}),
    ]);
    expect(streaks.map(summary)).toEqual(
      expect.arrayContaining([
        ["wins", 3, 3],
        ["homeWins", 3, 3],
        ["divisionWins", 2, 2],
      ]),
    );
  });

  it("the team's newer streaks read the score and the takeaways", () => {
    const streaks = teamStreaks([
      game(1, { us: 31, them: 28, takeaways: 2 }),
      game(2, { us: 35, them: 14, takeaways: 1 }),
      game(3, { us: 20, them: 10, takeaways: null }),
    ]);
    const of = (key: string) => streaks.find((s) => s.key === key);
    expect(of("score30")).toMatchObject({ current: 0, longest: 2 });
    expect(of("allowUnder20")).toMatchObject({ current: 2, longest: 2 });
    // A game with no team stats is not a game without a takeaway.
    expect(of("takeawayGames")).toMatchObject({ current: 2, longest: 2 });
  });

  it("season runs need a whole season to count", () => {
    const season = (year: number, wins: number, playoffs: boolean) => ({
      at: { seasonId: `s${year}`, year },
      wins,
      losses: 17 - wins,
      playoffs,
      divisionTitle: false,
    });
    const streaks = seasonStreaks([season(2026, 11, true), season(2027, 12, true), season(2028, 7, false)]);
    expect(streaks.find((s) => s.key === "tenWinSeasons")).toMatchObject({
      current: 0,
      longest: 2,
      longestTo: { year: 2027 },
    });
  });

  it("player streaks count only the games they apply to", () => {
    const streaks = playerStreaks(
      [
        { rushAtt: 20, rushYds: 120, rushTd: 1 },
        { rec: 3, recYds: 20 },
        { rushAtt: 18, rushYds: 101 },
      ].map((line, i) => ({ at: at(i + 1), line })),
    );
    expect(streaks.find((s) => s.key === "rush100")).toMatchObject({
      current: 2,
      longest: 2,
      currentFrom: at(1),
    });
    expect(streaks.find((s) => s.key === "appearances")).toMatchObject({ current: 3, longest: 3 });
  });

  it("a quarterback's clean games are counted, not the games he did not throw", () => {
    const streaks = playerStreaks(
      [{ passAtt: 30, passInt: 0 }, { rushAtt: 2 }, { passAtt: 28 }].map((line, i) => ({
        at: at(i + 1),
        line,
      })),
    );
    expect(streaks.find((s) => s.key === "noIntGames")).toMatchObject({ current: 2, longest: 2 });
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
