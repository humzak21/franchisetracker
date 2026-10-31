import { describe, expect, test } from "vitest";
import type { WeekKey } from "../domain/calendar";
import { gameTurn, quarterScoring } from "./quarters";
import {
  splitGameOf,
  splitLabel,
  splitLines,
  splitSections,
  splitTeamGames,
  splitTest,
  versusSplit,
  type SplitGame,
} from "./splits";
import { mergeTeamEntries, teamSeasonEntries, type TeamGameFacts } from "./teamRecords";

const rushing = (...yards: number[]) =>
  yards.map((rushYds, i) => ({ gameId: `g2026-${i + 1}`, stats: { rushYds } }));

describe("splits", () => {
  const facts = (n: number, over: Partial<SplitGame>): SplitGame => ({
    gameId: `g2026-${n}`,
    weekKey: `w${n}` as WeekKey,
    home: true,
    won: true,
    lost: false,
    margin: 7,
    division: false,
    conference: true,
    overtime: false,
    opponent: "BUF",
    ...over,
  });
  const lines = rushing(100, 50, 25);
  const games = [
    facts(1, {}),
    facts(2, { home: false, won: false, lost: true, margin: -20, opponent: "MIA" }),
    facts(10, { gameId: "g2026-3", weekKey: "w10", overtime: true }),
  ];
  const totals = (kind: Parameters<typeof splitLines>[2]) =>
    splitLines(lines, games, kind).map((g) => [g.key, g.summary.gamesPlayed, g.summary.totals.rushYds]);

  test("groups a player's lines, each group summarized like a season row", () => {
    expect(totals("venue")).toEqual([
      ["home", 2, 125],
      ["away", 1, 50],
    ]);
    expect(totals("outcome")).toEqual([
      ["wins", 2, 125],
      ["losses", 1, 50],
    ]);
  });

  test("empty groups are left out", () => {
    expect(totals("overtime")).toEqual([["overtime", 1, 25]]);
    expect(totals("opponent").map(([key]) => key)).toEqual(["conference"]);
  });

  test("margins and the season's halves", () => {
    expect(totals("margin")).toEqual([
      ["oneScore", 2, 125],
      ["blowout", 1, 50],
    ]);
    expect(totals("phase")).toEqual([
      ["regular", 3, 175],
      ["firstHalf", 2, 150],
      ["secondHalf", 1, 25],
    ]);
  });

  test("one group per opponent met", () => {
    expect(totals("byOpponent")).toEqual([
      ["BUF", 2, 125],
      ["MIA", 1, 50],
    ]);
  });

  test("a playoff game counts only in the playoffs group", () => {
    const withPlayoffs = [...games, facts(4, { gameId: "g2026-4", weekKey: "wc", home: true })];
    const allLines = [...lines, { gameId: "g2026-4", stats: { rushYds: 200 } }];
    const groups = (kind: Parameters<typeof splitLines>[2]) =>
      splitLines(allLines, withPlayoffs, kind).map((g) => [g.key, g.summary.totals.rushYds]);
    expect(groups("venue")).toEqual([
      ["home", 125],
      ["away", 50],
    ]);
    expect(groups("phase")).toContainEqual(["playoffs", 200]);
    expect(groups("phase")).toContainEqual(["regular", 175]);
  });

  test("a game's facts read from the user's side", () => {
    const base = {
      gameId: "g",
      weekKey: "w3" as WeekKey,
      userIsHome: false,
      us: 20,
      them: 23,
      overtime: false,
      own: { conference: "AFC", division: "East" },
    };
    const division = { abbr: "BUF", conference: "AFC", division: "East" };
    expect(splitGameOf({ ...base, lineScore: null, opponent: division })).toMatchObject({
      home: false,
      won: false,
      lost: true,
      margin: -3,
      division: true,
      conference: true,
      overtime: false,
    });
    const nfc = { abbr: "DAL", conference: "NFC", division: "East" };
    const overtime = { home: [7, 7, 3, 3, 3], away: [7, 7, 3, 3, 0] };
    expect(splitGameOf({ ...base, lineScore: overtime, opponent: nfc })).toMatchObject({
      division: false,
      conference: false,
      overtime: true,
    });
  });

  test("one group by key, for a question", () => {
    const [first, second] = games as [SplitGame, SplitGame];
    expect(splitTest("home")?.(first)).toBe(true);
    expect(splitTest("home")?.(second)).toBe(false);
    expect(splitTest(versusSplit("MIA"))?.(second)).toBe(true);
    expect(splitTest("nope")).toBeNull();
    expect(splitLabel("oneScore")).toBe("One-score games");
    expect(splitLabel(versusSplit("MIA"))).toBe("vs MIA");
  });

  test("the team's games add up by group, yards over the games that have them", () => {
    const team = games.map((g, i) => ({
      ...g,
      pointsFor: 20 + i,
      pointsAgainst: 10,
      yards: i === 0 ? null : 300,
      yardsAllowed: null,
    }));
    expect(splitTeamGames(team, "venue")[0]).toMatchObject({
      key: "home",
      games: 2,
      wins: 2,
      losses: 0,
      ties: 0,
      pointsFor: 42,
      yardsPerGame: 300,
      allowedPerGame: null,
    });
  });

  test("sections leave out kinds with nothing to show", () => {
    expect(splitSections((k) => (k === "venue" ? ["a"] : []))).toEqual([
      { kind: "venue", label: "Home and away", groups: ["a"] },
    ]);
  });
});

describe("quarters", () => {
  const play = (period: number, homeScore: number, awayScore: number) => ({
    period,
    clock: 300,
    homeScore,
    awayScore,
  });

  test("adds up by period from the user's side, plays over a printed line", () => {
    const scoring = quarterScoring([
      { userIsHome: true, lineScore: { home: [7, 0, 0, 7], away: [0, 3, 0, 0] }, plays: [] },
      { userIsHome: false, lineScore: { home: [9, 9, 9, 9], away: [9, 9, 9, 9] }, plays: [play(2, 0, 7)] },
      { userIsHome: true, lineScore: null, plays: [] },
    ]);
    expect(scoring.games).toBe(2);
    expect(scoring.periods.map((p) => [p.period, p.pointsFor, p.pointsAgainst])).toEqual([
      [1, 7, 0],
      [2, 7, 3],
      [3, 0, 0],
      [4, 7, 0],
    ]);
    expect(scoring.firstHalf).toBe(11);
    expect(scoring.secondHalf).toBe(7);
  });

  test("overtime adds a row and stays out of the second half", () => {
    const scoring = quarterScoring([
      { userIsHome: true, lineScore: { home: [0, 0, 0, 0, 6], away: [0, 0, 0, 0, 0] }, plays: [] },
    ]);
    expect(scoring.periods).toHaveLength(5);
    expect(scoring.secondHalf).toBe(0);
  });

  test("plays see a lead lost inside a quarter that the line score cannot", () => {
    const plays = [play(1, 0, 14), play(1, 21, 14)];
    const line = { home: [21, 0, 0, 0], away: [14, 0, 0, 0] };
    expect(gameTurn({ userIsHome: true, lineScore: line, plays }).comeback).toBe(14);
    expect(gameTurn({ userIsHome: true, lineScore: line, plays: [] }).comeback).toBe(0);
  });

  test("a line score still reads a comeback and a lead lost, quarter by quarter", () => {
    const line = { home: [0, 0, 3, 14], away: [10, 0, 0, 0] };
    expect(gameTurn({ userIsHome: true, lineScore: line, plays: [] })).toEqual({
      comeback: 10,
      blownLead: 0,
    });
    expect(gameTurn({ userIsHome: false, lineScore: line, plays: [] })).toEqual({
      comeback: 0,
      blownLead: 10,
    });
    expect(gameTurn({ userIsHome: true, lineScore: null, plays: [] })).toEqual({ comeback: 0, blownLead: 0 });
  });
});

describe("team records", () => {
  const facts = (n: number, us: number, them: number, over: Partial<TeamGameFacts> = {}): TeamGameFacts => ({
    gameId: `g${n}`,
    seasonId: "s2026",
    year: 2026,
    weekKey: `w${n}` as WeekKey,
    opponentTeamId: "BUF",
    userIsHome: true,
    us,
    them,
    won: us > them,
    own: { totalYds: 400 + n },
    opponent: { totalYds: 300 - n, turnovers: n, sacksAllowed: 1 },
    lineScore: { home: [14, us - 14, 0, 0], away: [them, 0, 0, 0] },
    plays: [],
    ...over,
  });
  const lists = teamSeasonEntries([facts(1, 31, 17), facts(2, 20, 27)]);
  const list = (statKey: string, scope: string) =>
    lists.find((l) => l.statKey === statKey && l.scope === scope)?.entries ?? [];

  test("reads scores, team stats and quarters into their lists", () => {
    expect(list("pointsFor", "game").map((e) => e.value)).toEqual([31, 20]);
    expect(list("biggestWin", "game").map((e) => e.value)).toEqual([14]);
    expect(list("worstLoss", "game")).toEqual([expect.objectContaining({ value: 7, gameId: "g2" })]);
    expect(list("takeaways", "game").map((e) => e.value)).toEqual([1, 2]);
    expect(list("pointsInQuarter", "game")[0]).toMatchObject({ value: 17, period: 2 });
  });

  test("a season list is one entry, totalled", () => {
    expect(list("pointsFor", "season")).toEqual([{ value: 51, seasonId: "s2026", year: 2026 }]);
    expect(list("wins", "season")[0]?.value).toBe(1);
    expect(list("pointDifferential", "season")[0]?.value).toBe(7);
  });

  test("a stat with no captured team stats has no entry rather than a zero", () => {
    const bare = teamSeasonEntries([facts(1, 10, 3, { own: null, opponent: null })]);
    expect(bare.find((l) => l.statKey === "totalYds" && l.scope === "game")?.entries).toEqual([]);
    expect(bare.find((l) => l.statKey === "totalYds" && l.scope === "season")?.entries).toEqual([]);
  });

  test("no games, no lists", () => {
    expect(teamSeasonEntries([])).toEqual([]);
  });

  test("a merge replaces one season's entries and sorts by the stat's direction", () => {
    const entry = (value: number, seasonId: string, year: number) => ({ value, seasonId, year });
    const most = mergeTeamEntries("pointsFor", [entry(40, "a", 2026), entry(50, "b", 2027)], "a", [
      entry(45, "a", 2026),
    ]);
    expect(most.map((e) => e.value)).toEqual([50, 45]);
    const fewest = mergeTeamEntries("pointsAgainst", [entry(10, "b", 2027)], "a", [entry(3, "a", 2026)]);
    expect(fewest.map((e) => e.value)).toEqual([3, 10]);
  });
});
